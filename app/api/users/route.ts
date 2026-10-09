import {getChatGPTUser} from '@/app/chatgpt-auth';
import {accessFor,OWNER_EMAIL} from '@/db/access';
import {database} from '@/db/store';
import {backend,fsUsers,fsSaveUser} from '@/db/firestore-store';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{
 const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 const access=await accessFor(user);if(!access)return reply({error:'Acesso não autorizado.'},403);
 if(new URL(request.url).searchParams.has('me'))return reply(access);
 if(!access.isAdmin)return reply({error:'Somente o administrador gerencia usuários.'},403);
 if(backend()==='firestore')return reply(await fsUsers());
 const {results:users}=await database().prepare('SELECT email,name,permission,active,version,last_seen AS lastSeen FROM app_users ORDER BY name,email').all();
 const {results:history}=await database().prepare('SELECT email,actor,message,created_at FROM user_events ORDER BY id DESC LIMIT 30').all();
 return reply({users,history});
 }catch(e){console.error(e);return reply({error:'Não é possível carregar os usuários.'},503);}}
export async function POST(request:Request){try{
 const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta.'},401);
 const access=await accessFor(user);if(!access?.isAdmin)return reply({error:'Somente o administrador gerencia usuários.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const raw:any=await request.json();if(!raw||typeof raw!=='object')return reply({error:'Dados inválidos.'},400);
 const email=typeof raw.email==='string'?raw.email.trim().toLowerCase():'';
 const name=typeof raw.name==='string'?raw.name.trim():'';
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length>150||!['read','edit','create'].includes(raw.permission)||typeof raw.active!=='boolean')return reply({error:'Informe nome, e-mail e uma permissão válida.'},400);
 if(email===OWNER_EMAIL)return reply({error:'O administrador principal permanece ativo e com acesso completo.'},400);
 if(backend()==='firestore'){const {status,...result}=await fsSaveUser(raw,email,name,user);return reply(result,status||200);}
 const db=database();const old=await db.prepare('SELECT name,permission,active,version FROM app_users WHERE email=?').bind(email).first<{name:string;permission:string;active:number;version:number}>();
 const now=new Date().toISOString();let result;
 if(old){
 if(raw.version!==old.version)return reply({error:'Este usuário mudou. Atualize a lista antes de salvar.'},409);
 const message=`Nome: ${name}; permissão: ${raw.permission}; ${raw.active?'ativo':'inativo'}.`;
 result=await db.batch([db.prepare('UPDATE app_users SET name=?,permission=?,active=?,version=version+1 WHERE email=? AND version=?').bind(name,raw.permission,Number(raw.active),email,raw.version),db.prepare('INSERT INTO user_events(email,actor,message,created_at) SELECT ?,?,?,? WHERE changes()=1').bind(email,user.email,message,now)]);
 }else{
 if(raw.version)return reply({error:'Usuário não encontrado. Atualize a lista.'},409);
 result=await db.batch([db.prepare('INSERT OR IGNORE INTO app_users(email,name,permission,active,version) VALUES(?,?,?,?,1)').bind(email,name,raw.permission,Number(raw.active)),db.prepare('INSERT INTO user_events(email,actor,message,created_at) SELECT ?,?,?,? WHERE changes()=1').bind(email,user.email,'Usuário cadastrado; permissão: '+raw.permission,now)]);
 }
 if(!result[0].meta.changes)return reply({error:'Este usuário mudou. Atualize a lista antes de salvar.'},409);
 return reply({ok:true},old?200:201);
 }catch(e){console.error(e);return reply({error:'Não é possível salvar o usuário. Tente novamente.'},503);}}
