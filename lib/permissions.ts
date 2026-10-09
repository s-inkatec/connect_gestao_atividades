export const PERMISSIONS = {
  read: 'Somente leitura',
  edit: 'Leitura e edição',
  create: 'Leitura, edição e gravação',
  admin: 'Administrador',
} as const;
export type Permission = keyof typeof PERMISSIONS;
export type Access = {email:string; name:string; permission:Permission; canEdit:boolean; canCreate:boolean; isAdmin:boolean};
export type ManagedUser = {email:string; name:string; permission:Permission; active:number; version:number; lastSeen:string|null};
export function capabilities(permission:Permission){return {canEdit:permission!=='read',canCreate:permission==='create'||permission==='admin',isAdmin:permission==='admin'};}
