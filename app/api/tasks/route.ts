import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,listTasks,initialize} from '@/db/store';
import {validateTask} from '@/lib/model';
import {accessFor} from '@/db/access';
export const dynamic='force-dynamic';
const reply=(x:any,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{const user=await getChatGPTUser();if(!user)return reply({error:'Entre na sua conta para acessar as atividades.'},401);if(!await accessFor(user))return reply({error:'Seu usuário não tem acesso às atividades.'},403);const id=new URL(request.url).searchParams.get('history');if(id){const {results}=await database().prepare('SELECT actor,message,created_at FROM events WHERE task_id=? ORDER BY id DESC LIMIT 30').bind(id).all();return reply(results);}return reply(await listTasks());}catch(e){console.error(e);return reply({error:'Não é possível carregar as atividades. Tente novamente.'},503);}}
export async function POST(request:Request){try{
 const user=await getChatGPTUser();if(!user)return reply({error:'Sessão encerrada. Entre novamente.'},401);
 const access=await accessFor(user);if(!access)return reply({error:'Seu usuário não tem acesso às atividades.'},403);
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return reply({error:'Origem inválida.'},403);
 const raw:any=await request.json();if(!raw||typeof raw!=='object')return reply({error:'Dados inválidos.'},400);if(raw.id?!access.canEdit:!access.canCreate)return reply({error:raw.id?'Sua permissão permite apenas consultar atividades.':'Sua permissão não permite criar atividades.'},403);let value;try{value=validateTask(raw);}catch(e){return reply({error:(e as Error).message},400);}
 await initialize();const db=database();const now=new Date().toISOString();
 if(raw.id){
 if(typeof raw.id!=='string'||!Number.isInteger(raw.version)||raw.version<1)return reply({error:'Versão inválida.'},400);
 const current=await db.prepare('SELECT payload FROM tasks WHERE id=?').bind(raw.id).first<{payload:string}>();if(!current)return reply({error:'Atividade não encontrada.'},404);
 const old=JSON.parse(current.payload);const labels:any={title:'Demanda',type:'Tipo',status:'Status',priority:'Prioridade',owner:'Responsável',due:'Prazo',reference:'Referência',description:'Descrição',nextAction:'Próxima ação'};
 const changed=Object.keys(value).filter(k=>old[k]!==value[k]);if(!changed.length)return reply({ok:true,id:raw.id});
 const message=changed.map(k=>`${labels[k]}: ${old[k]||'sem informação'} → ${value[k]||'sem informação'}`).join('\n');
 const result=await db.batch([db.prepare('UPDATE tasks SET payload=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify({...value,id:raw.id}),now,raw.id,raw.version),db.prepare('INSERT INTO events(task_id,actor,message,created_at) SELECT ?,?,?,? WHERE changes()=1').bind(raw.id,user.displayName,message,now)]);
 if(!result[0].meta.changes)return reply({error:'Outra edição altera esta atividade. Atualize a lista antes de salvar.'},409);
 return reply({ok:true,id:raw.id});
 }
 const id=crypto.randomUUID();await db.batch([db.prepare('INSERT INTO tasks(id,payload,version,updated_at) VALUES(?,?,1,?)').bind(id,JSON.stringify({...value,id}),now),db.prepare('INSERT INTO events(task_id,actor,message,created_at) VALUES(?,?,?,?)').bind(id,user.displayName,'Atividade criada.',now)]);return reply({ok:true,id},201);
 }catch(e){console.error(e);return reply({error:'Não é possível salvar. Seus dados continuam no formulário.'},503);}}

