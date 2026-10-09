// Run only after deploying DATA_BACKEND=maintenance and exporting the live D1.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
export function transform(source,documentId){
 for(const table of ['tasks','app_users','events','user_events'])if(!Array.isArray(source[table]))throw Error('Snapshot incompleto: '+table);
 const docs=new Map(),ids=new Set();
 const add=(p,v)=>{if(docs.has(p))throw Error('Documento duplicado: '+p);docs.set(p,v);};
 source.tasks.forEach((r,index)=>{const v=JSON.parse(r.payload);if(!r.id||ids.has(r.id)||!Number.isInteger(r.version)||r.version<1)throw Error('Atividade inválida.');ids.add(r.id);if(!['Bug','Melhoria','Novo Projeto'].includes(v.type)||typeof v.title!=='string')throw Error('Classificação inválida.');add('atividades/'+documentId(r.id),{...v,id:r.id,version:r.version,updatedAt:r.updated_at,sourceOrder:index});});
 source.app_users.forEach(u=>{if(u.email!==u.email.trim().toLowerCase()||!['admin','read','edit','create'].includes(u.permission)||![0,1].includes(u.active)||!Number.isInteger(u.version))throw Error('Usuário inválido.');add('usuarios/'+documentId(u.email),{email:u.email,name:u.name,userId:u.user_id??null,permission:u.permission,active:u.active,version:u.version,lastSeen:u.last_seen??null});if(u.user_id)add('identidades/'+documentId(u.user_id),{email:u.email,userId:u.user_id});});
 const owner=source.app_users.find(u=>u.email==='silvio.goncalves@rdcviagens.com.br');if(!owner||owner.permission!=='admin'||owner.active!==1)throw Error('Administrador principal inválido.');
 source.events.forEach(e=>{if(!ids.has(e.task_id))throw Error('Histórico sem atividade.');add('atividades/'+documentId(e.task_id)+'/historico/d1-'+e.id,{actor:e.actor,message:e.message,created_at:e.created_at,legacyId:e.id});});
 source.user_events.forEach(e=>add('historicoPermissoes/d1-'+e.id,{email:e.email,actor:e.actor,message:e.message,created_at:e.created_at,legacyId:e.id}));
 return docs;
}
async function main(){
 const [snapshotPath,credentialsPath,confirmation]=process.argv.slice(2);
 if(!snapshotPath||!credentialsPath||confirmation!=='--source-frozen')throw Error('Uso: node scripts/migrate-firestore.mjs SNAPSHOT.json CHAVE.json --source-frozen');
 const source=JSON.parse(await readFile(snapshotPath,'utf8')),account=JSON.parse(await readFile(credentialsPath,'utf8'));
 if(account.project_id!=='connect-gestao-de-atividades'||account.client_email!=='connect-gestao-firestore@connect-gestao-de-atividades.iam.gserviceaccount.com')throw Error('Conta de destino diferente da autorizada.');
 await mkdir('.sites-runtime',{recursive:true});const compiled=ts.transpileModule(await readFile('db/firestore-client.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const modulePath=path.resolve('.sites-runtime/firestore-client.mjs');await writeFile(modulePath,compiled);
 const {Firestore,data,documentId}=await import(pathToFileURL(modulePath).href);const fs=new Firestore(account),docs=transform(source,documentId);
 const checksum=createHash('sha256').update(canonical([...docs])).digest('hex');
 const existing=await fs.get('configuracoes/migracao');if(existing&&data(existing).checksum!==checksum)throw Error('Destino já contém outra migração.');
 // Resume identical documents; never overwrite divergent destination data.
 const pending=[];for(const [p,v] of docs){const old=await fs.get(p);if(old){if(canonical(data(old))!==canonical(v))throw Error('Destino divergente: '+p);}else pending.push(fs.write(p,v,{exists:false}));}
 for(let i=0;i<pending.length;i+=400)await fs.commit(pending.slice(i,i+400));
 for(const [p,v] of docs){const saved=await fs.get(p);if(!saved||canonical(data(saved))!==canonical(v))throw Error('Validação falha: '+p);}
 for(const [collection,prefix] of [['atividades','atividades/'],['usuarios','usuarios/'],['identidades','identidades/'],['historicoPermissoes','historicoPermissoes/']]){const expected=[...docs.keys()].filter(p=>p.startsWith(prefix)&&p.split('/').length===2).length;if((await fs.list(collection)).length!==expected)throw Error('Contagem divergente: '+collection);}
 const counts=Object.fromEntries(['tasks','app_users','events','user_events'].map(k=>[k,source[k].length]));
 const report={schemaVersion:1,status:'verified',source:'Sites D1 DB',checksum,counts,verifiedAt:new Date().toISOString()};
 await fs.commit([fs.write('configuracoes/migracao',report,existing?{updateTime:existing.updateTime}:{exists:false}),fs.write('configuracoes/estrutura',{schemaVersion:1,collections:['atividades','usuarios','identidades','historicoPermissoes','configuracoes'],taskHistory:'atividades/{id}/historico',authentication:'Site dispatcher identity; server authorization'})]);
 await writeFile('.sites-runtime/migration-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1')))main().catch(e=>{console.error(e.message);process.exitCode=1;});
