import {env} from 'cloudflare:workers';
import {Firestore,FirestoreError,data,documentId} from './firestore-client';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {capabilities,type Permission} from '@/lib/permissions';
let client:Firestore;
export function backend(){return (env as any).DATA_BACKEND||'d1';}
export function available(){if(backend()==='maintenance')throw Error('Migração em andamento. Tente novamente em alguns minutos.');}
export function firestore(){if(!client){const raw=(env as any).FIREBASE_SERVICE_ACCOUNT;if(!raw)throw Error('Segredo Firestore ausente.');client=new Firestore(JSON.parse(raw));}return client;}
export async function ready(){const d=await firestore().get('configuracoes/migracao');if(!d||data(d).status!=='verified')throw Error('Migração Firestore não validada.');}
export async function fsTasks(){await ready();return (await firestore().list('atividades')).map(data).sort((a,b)=>(a.sourceOrder||0)-(b.sourceOrder||0)||a.title.localeCompare(b.title,'pt-BR'));}
export async function fsHistory(id:string){return (await firestore().list('atividades/'+documentId(id)+'/historico',30,'created_at desc')).map(data);}
export async function fsUsers(){return {users:(await firestore().list('usuarios')).map(data).map(({userId,...u})=>u).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),history:(await firestore().list('historicoPermissoes',30,'created_at desc')).map(data)};}
export async function fsAccess(user:ChatGPTUser){await ready();const fs=firestore(),email=user.email.trim().toLowerCase(),path='usuarios/'+documentId(email),identity='identidades/'+documentId(user.userId);
 for(let attempt=0;attempt<3;attempt++){
 const doc=await fs.get(path);if(!doc)return null;const u=data(doc);if(!u.active||u.userId&&u.userId!==user.userId)return null;
 const writes:any[]=[];if(!u.userId){const bound=await fs.get(identity);if(bound&&data(bound).email!==email)return null;if(!bound)writes.push(fs.write(identity,{email,userId:user.userId},{exists:false}));}
 if(!u.userId||!u.lastSeen||Date.now()-Date.parse(u.lastSeen)>900000)writes.unshift(fs.write(path,{...u,userId:user.userId,lastSeen:new Date().toISOString()},{updateTime:doc.updateTime}));
 try{if(writes.length)await fs.commit(writes);return {email,name:u.name,permission:u.permission as Permission,...capabilities(u.permission)};}catch(e){if(!(e instanceof FirestoreError)||![409,412].includes(e.status))throw e;}
 }throw Error('Outra sessão atualiza seu usuário. Tente novamente.');}
export async function fsSaveTask(raw:any,value:any,user:ChatGPTUser){const fs=firestore();if(raw.id){const path='atividades/'+documentId(raw.id),doc=await fs.get(path);if(!doc)return {error:'Atividade não encontrada.',status:404};const old=data(doc);if(old.version!==raw.version)return {error:'Outra edição altera esta atividade. Atualize a lista antes de salvar.',status:409};
 const labels:any={title:'Demanda',type:'Tipo',status:'Status',priority:'Prioridade',owner:'Responsável',due:'Prazo',reference:'Referência',description:'Descrição',nextAction:'Próxima ação'};const changed=Object.keys(value).filter(k=>old[k]!==value[k]);if(!changed.length)return {ok:true,id:raw.id};const now=new Date().toISOString();const message=changed.map(k=>`${labels[k]}: ${old[k]||'sem informação'} → ${value[k]||'sem informação'}`).join('\n');
 try{await fs.commit([fs.write(path,{...old,...value,version:old.version+1,updatedAt:now},{updateTime:doc.updateTime}),fs.write(path+'/historico/'+crypto.randomUUID(),{actor:user.displayName,actorId:user.userId,message,created_at:now},{exists:false})]);}catch(e){if(e instanceof FirestoreError&&[409,412].includes(e.status))return {error:'Outra edição altera esta atividade. Atualize a lista antes de salvar.',status:409};throw e;}return {ok:true,id:raw.id};}
 const id=crypto.randomUUID(),path='atividades/'+documentId(id),now=new Date().toISOString();await fs.commit([fs.write(path,{...value,id,version:1,updatedAt:now,sourceOrder:Date.now()},{exists:false}),fs.write(path+'/historico/'+crypto.randomUUID(),{actor:user.displayName,actorId:user.userId,message:'Atividade criada.',created_at:now},{exists:false})]);return {ok:true,id,status:201};}
export async function fsSaveUser(raw:any,email:string,name:string,user:ChatGPTUser){const fs=firestore(),path='usuarios/'+documentId(email),doc=await fs.get(path),old=doc?data(doc):null;
 if(old?old.version!==raw.version:!!raw.version)return {error:'Este usuário mudou. Atualize a lista antes de salvar.',status:409};
 const now=new Date().toISOString(),value={...(old||{userId:null,lastSeen:null}),email,name,permission:raw.permission,active:Number(raw.active),version:(old?.version||0)+1};
 try{await fs.commit([fs.write(path,value,doc?{updateTime:doc.updateTime}:{exists:false}),fs.write('historicoPermissoes/'+crypto.randomUUID(),{email,actor:user.email,actorId:user.userId,message:`Nome: ${name}; permissão: ${raw.permission}; ${raw.active?'ativo':'inativo'}.`,created_at:now},{exists:false})]);}catch(e){if(e instanceof FirestoreError&&[409,412].includes(e.status))return {error:'Este usuário mudou. Atualize a lista antes de salvar.',status:409};throw e;}
 return {ok:true,status:old?200:201};}
