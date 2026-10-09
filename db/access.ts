import {database} from './store';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {capabilities,type Access,type Permission} from '@/lib/permissions';
export const OWNER_EMAIL='silvio.goncalves@rdcviagens.com.br';
export async function initializeUsers(){
 const db=database();
 await db.batch([
 db.prepare("INSERT OR IGNORE INTO app_users(email,name,permission,active,version) VALUES(?,?,'admin',1,1)").bind(OWNER_EMAIL,'Silvio Rodrigues Goncalves'),
 db.prepare("INSERT OR IGNORE INTO app_users(email,name,permission,active,version) VALUES(?,?,'create',1,1)").bind('paulo.albuquerque@rdcviagens.com.br','Paulo Albuquerque'),
 ]);
}
export async function accessFor(user:ChatGPTUser):Promise<Access|null>{
 await initializeUsers();const db=database();const email=user.email.trim().toLowerCase();
 // The dispatcher supplies identity; bind invited email to its stable Site user ID once.
 await db.prepare('UPDATE app_users SET user_id=?,last_seen=? WHERE email=? AND active=1 AND (user_id IS NULL OR user_id=?)').bind(user.userId,new Date().toISOString(),email,user.userId).run();
 const row=await db.prepare('SELECT email,name,permission FROM app_users WHERE email=? AND user_id=? AND active=1').bind(email,user.userId).first<{email:string;name:string;permission:Permission}>();
 return row?{...row,...capabilities(row.permission)}:null;
}
