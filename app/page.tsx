import {requireChatGPTUser} from './chatgpt-auth';
import Workspace from './workspace';
import {accessFor} from '@/db/access';
import {backend} from '@/db/firestore-store';
export const dynamic='force-dynamic';
export default async function Page(){if(backend()==='maintenance')return <main className="panel"><h1>Migração em andamento</h1><p>A base de dados passa por atualização. Tente novamente em alguns minutos.</p></main>;const user=await requireChatGPTUser('/');const access=await accessFor(user);if(!access)return <main className="panel"><h1>Acesso não autorizado</h1><p>Seu usuário está inativo ou não está cadastrado. Solicite acesso ao administrador.</p><p>{user.email}</p><a href="/signout-with-chatgpt?return_to=/">Trocar de conta</a></main>;return <Workspace userName={user.displayName} initialAccess={access}/>;}
