import {env} from 'cloudflare:workers';
import seed from '@/lib/seed.json';
export function database(){if(!env.DB)throw Error('Banco indisponível.');return env.DB;}
export async function initialize(){const db=database();await db.batch(seed.map(t=>db.prepare('INSERT OR IGNORE INTO tasks (id,payload,version,updated_at) VALUES (?,?,1,?)').bind(t.id,JSON.stringify(t),'2026-10-09T00:00:00Z')));}
export async function listTasks(){await initialize();const {results}=await database().prepare('SELECT id,payload,version,updated_at FROM tasks ORDER BY rowid').all<{id:string;payload:string;version:number;updated_at:string}>();return results.map(r=>({...JSON.parse(r.payload),id:r.id,version:r.version,updatedAt:r.updated_at}));}
