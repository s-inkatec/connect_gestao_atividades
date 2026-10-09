// REST + WebCrypto works in both Cloudflare Workers and the migration CLI.
export type ServiceAccount={project_id:string;client_email:string;private_key:string};
export type Document={name:string;fields:Record<string,any>;updateTime:string};
export class FirestoreError extends Error {constructor(public status:number,public code:string){super('Firestore '+code);}}
export function encode(v:any):any {
 if(v===null)return {nullValue:null};if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};
 if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
 if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};
 if(v&&typeof v==='object')return {mapValue:{fields:fields(v)}};throw Error('Valor Firestore inválido.');
}
export function fields(o:Record<string,any>){return Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));}
export function decode(v:any):any {if('nullValue'in v)return null;if('stringValue'in v)return v.stringValue;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);if('mapValue'in v)return data({fields:v.mapValue.fields||{}});throw Error('Tipo Firestore não suportado.');}
export function data(d:{fields?:Record<string,any>}):any{return Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]));}
function base64(bytes:Uint8Array){let str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export const documentId=(v:string)=>base64(new TextEncoder().encode(v));
export class Firestore {
 readonly root:string;private token:string='';private expires=0;private pending:Promise<string>|null=null;
 constructor(private account:ServiceAccount){if(!/^[a-z][a-z0-9-]+$/.test(account.project_id)||!account.client_email||!account.private_key)throw Error('Configuração Firestore inválida.');this.root=`projects/${account.project_id}/databases/(default)/documents`;}
 name(path:string){return this.root+'/'+path;}
 async accessToken():Promise<string>{if(this.token&&this.expires>Date.now()+60000)return this.token;if(this.pending)return this.pending;
 this.pending=this.issueToken();try{return await this.pending;}finally{this.pending=null;}}
 private async issueToken(){const now=Math.floor(Date.now()/1000);const enc=(o:any)=>base64(new TextEncoder().encode(JSON.stringify(o)));const jwt=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:this.account.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const pem=this.account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');const der=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(jwt));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt+'.'+base64(new Uint8Array(signature))}),signal:AbortSignal.timeout(15000)});const d:any=await r.json();if(!r.ok||!d.access_token)throw new FirestoreError(r.status,'AUTH_FAILED');this.token=d.access_token;this.expires=Date.now()+d.expires_in*1000;return this.token;}
 async request(path:string,method='GET',body?:any):Promise<any>{const r=await fetch('https://firestore.googleapis.com/v1/'+this.root+path,{method,headers:{Authorization:'Bearer '+await this.accessToken(),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const d:any=await r.json();if(!r.ok)throw new FirestoreError(r.status,d.error?.status||'UNKNOWN');return d;}
 async get(path:string):Promise<Document|null>{try{return await this.request('/'+path);}catch(e){if(e instanceof FirestoreError&&e.status===404)return null;throw e;}}
 async list(path:string,limit?:number,orderBy?:string):Promise<Document[]>{let docs:Document[]=[],token='';do{const q=new URLSearchParams({pageSize:String(limit||100)});if(token)q.set('pageToken',token);if(orderBy)q.set('orderBy',orderBy);const d=await this.request('/'+path+'?'+q);docs.push(...(d.documents||[]));token=d.nextPageToken||'';if(limit)break;}while(token);return docs;}
 write(path:string,value:any,precondition?:any){return {update:{name:this.name(path),fields:fields(value)},...(precondition?{currentDocument:precondition}:{})};}
 async commit(writes:any[]){return this.request(':commit','POST',{writes});}
}
