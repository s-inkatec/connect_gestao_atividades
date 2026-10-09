export const TYPES=['Bug','Melhoria','Novo Projeto'] as const;
export const STATUSES=['A analisar','A priorizar','Backlog','Em análise','Em andamento','Em homologação','Pausado','Concluído'] as const;
export const PRIORITIES=['Urgente','Importante','Média'] as const;
export type Task={id:string;type:string;title:string;status:string;priority:string;owner:string;due:string;reference:string;description:string;nextAction:string;version:number;updatedAt?:string};
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
export const overdue=(t:Task,date=today())=>t.status!=='Concluído'&&!!t.due&&t.due<date;
export function validateTask(v:any){
 if(!v || typeof v!=='object')throw Error('Dados inválidos.');
 const fields=['type','title','status','priority','owner','due','reference','description','nextAction'];
 const out:any={};for(const k of fields){if(typeof v[k]!=='string')throw Error('Campo inválido: '+k);out[k]=v[k].trim();if(out[k].length>(['description','nextAction'].includes(k)?4000:500))throw Error('Texto muito longo.');}
 if(!out.title)throw Error('Informe o nome da atividade.');
 if(!TYPES.includes(out.type)||!STATUSES.includes(out.status)||!PRIORITIES.includes(out.priority))throw Error('Tipo, status ou prioridade inválido.');
 if(out.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(out.due)||new Date(out.due+'T12:00:00Z').toISOString().slice(0,10)!==out.due))throw Error('Prazo inválido.');
 return out;
}
