import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import {transform} from './migrate-firestore.mjs';
await mkdir('.sites-runtime/test-firestore',{recursive:true});
for(const file of ['db/firestore-client.ts','db/firestore-store.ts','lib/permissions.ts']){
 let source=await readFile(file,'utf8');
 source=source.replace("import {env} from 'cloudflare:workers';","const env=globalThis.__testEnv;").replace("from './firestore-client'","from './firestore-client.mjs'").replace("from '@/lib/permissions'","from './permissions.mjs'");
 await writeFile('.sites-runtime/test-firestore/'+path.basename(file,'.ts')+'.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
}
const moduleUrl=f=>pathToFileURL(path.resolve('.sites-runtime/test-firestore/'+f)).href;
const {FirestoreError,data,fields,documentId}=await import(moduleUrl('firestore-client.mjs'));
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const key=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
globalThis.__testEnv={DATA_BACKEND:'firestore',FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'connect-gestao-de-atividades',client_email:'test@example.com',private_key:'-----BEGIN PRIVATE KEY-----\n'+key+'\n-----END PRIVATE KEY-----'})};
const {fsAccess,fsSaveTask,fsSaveUser,fsHistory,available}=await import(moduleUrl('firestore-store.mjs'));
const docs=new Map();let revision=0,commits=0;
const save=(p,v)=>docs.set(p,{name:p,fields:fields(v),updateTime:String(++revision)});
globalThis.fetch=async(url,init={})=>{
 if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'test-token',expires_in:3600});
 const p=decodeURIComponent(new URL(url).pathname.split('/documents')[1]);
 if(p===':commit'){
 const writes=JSON.parse(init.body).writes;
 for(const w of writes){const target=w.update.name.split('/documents/')[1],current=docs.get(target),pre=w.currentDocument;if(pre&&('exists'in pre?pre.exists!==!!current:pre.updateTime!==current?.updateTime))return Response.json({error:{status:'FAILED_PRECONDITION'}},{status:412});}
 for(const w of writes){const target=w.update.name.split('/documents/')[1];docs.set(target,{name:target,fields:w.update.fields,updateTime:String(++revision)});}commits++;return Response.json({writeResults:writes.map(()=>({updateTime:String(revision)}))});
 }
 const target=p.slice(1);if(docs.has(target))return Response.json(docs.get(target));
 const listed=[...docs.entries()].filter(([k])=>k.startsWith(target+'/')&&k.split('/').length===target.split('/').length+1).map(([,v])=>v);
 if(listed.length||['atividades','usuarios','identidades','historicoPermissoes'].includes(target)||target.endsWith('/historico'))return Response.json({documents:listed});
 return Response.json({error:{status:'NOT_FOUND'}},{status:404});
};
save('configuracoes/migracao',{status:'verified'});
const user={email:'editor@example.com',userId:'site-editor',displayName:'Editor'};
const userPath='usuarios/'+documentId(user.email);
save(userPath,{email:user.email,name:'Editor',permission:'edit',active:1,version:1,userId:null,lastSeen:null});
assert.equal((await fsAccess(user)).canEdit,true);assert.equal(data(docs.get(userPath)).userId,user.userId);
assert.equal(await fsAccess({...user,userId:'impostor'}),null);
assert.equal(await fsAccess({...user,email:'unknown@example.com'}),null);
save('usuarios/'+documentId('other@example.com'),{email:'other@example.com',name:'Other',permission:'read',active:1,version:1,userId:null,lastSeen:null});
assert.equal(await fsAccess({...user,email:'other@example.com'}),null,'Identity cannot bind two emails');
save(userPath,{...data(docs.get(userPath)),active:0});assert.equal(await fsAccess(user),null);
const value={type:'Bug',title:'Exemplo',status:'Backlog',priority:'Média',owner:'',due:'',reference:'',description:'',nextAction:''};
const created=await fsSaveTask({},value,user);assert.equal(created.status,201);
const taskPath='atividades/'+documentId(created.id);assert.equal((await fsHistory(created.id)).length,1);
const edits=await Promise.all([fsSaveTask({id:created.id,version:1},{...value,nextAction:'A'},user),fsSaveTask({id:created.id,version:1},{...value,nextAction:'B'},user)]);
assert.equal(edits.filter(r=>r.ok).length,1);assert.equal(edits.filter(r=>r.status===409).length,1);assert.equal(data(docs.get(taskPath)).version,2);assert.equal((await fsHistory(created.id)).length,2,'Rejected write creates no history');
assert.equal((await fsSaveTask({id:created.id,version:1},value,user)).status,409,'Stale no-op is rejected');
const added=await fsSaveUser({permission:'read',active:true},'new@example.com','Novo',user);assert.equal(added.status,201);
assert.equal((await fsSaveUser({permission:'create',active:true,version:99},'new@example.com','Novo',user)).status,409);
const migrated=transform({tasks:[{id:'original',payload:JSON.stringify({...value,id:'original'}),version:3,updated_at:'2026-10-09T00:00:00Z'}],app_users:[{email:'silvio.goncalves@rdcviagens.com.br',name:'Silvio',permission:'admin',active:1,version:2,user_id:'stable',last_seen:null}],events:[],user_events:[]},documentId);
assert.equal(migrated.get('atividades/'+documentId('original')).version,3);assert.equal(migrated.get('identidades/'+documentId('stable')).email,'silvio.goncalves@rdcviagens.com.br');
globalThis.__testEnv.DATA_BACKEND='maintenance';assert.throws(available,/Migração/);
console.log('Firestore: identidade, permissão, gravação atômica, conflito concorrente, histórico, migração e manutenção validados. Commits: '+commits);
