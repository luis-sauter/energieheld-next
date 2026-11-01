import type { SupabaseClient } from '@supabase/supabase-js';
export type OfferMailConfig={host:string;port:number;secure:boolean;user:string;password:string;from:string;to:string;origin:string};
export function offerMailConfig(env:NodeJS.ProcessEnv):OfferMailConfig|null {
 if(env.OFFER_NOTIFICATION_ENABLED!=='true')return null;
 // The current rollout is a single branch preview; production stays disabled.
 if(env.NETLIFY==='true'&&env.BRANCH&&env.BRANCH!=='feature/portal-frontend')return null;
 const {SMTP_HOST:host,SMTP_USER:user,SMTP_PASSWORD:password,OFFER_NOTIFICATION_FROM:from,OFFER_NOTIFICATION_TO:to,OFFER_NOTIFICATION_ORIGIN:origin}=env;
 const email=(value:string|undefined)=>Boolean(value&&value.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value));
 const implicitTls=env.SMTP_PORT==='465'&&env.SMTP_SECURE==='true';
 const startTls=env.SMTP_PORT==='587'&&env.SMTP_SECURE==='false';
 if(!host||(!implicitTls&&!startTls)||!password||!email(user)||!email(from)||!email(to)||!origin)return null;
 try{const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)return null;}catch{return null;}
 return {host,port:implicitTls?465:587,secure:implicitTls,user:user!,password,from:from!,to:to!,origin};
}
export function offerMailMessage(config:OfferMailConfig,key:string){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))throw Error('Invalid request ID');
 return {from:config.from,to:config.to,subject:'Neue Angebotsanfrage – DAS Reiseportal',messageId:`<offer-${key}@${config.from.split('@')[1]}>`,text:`Eine neue Angebotsanfrage wurde im Reiseportal gespeichert.\n\nAnfrage: ${key}\nIm geschützten Redaktionsbereich öffnen:\n${new URL('/admin/werbung/'+key,config.origin).href}\n\nAngaben und gegebenenfalls hochgeladene Originalbilder finden Sie nach der Anmeldung dort.`};
}
export function offerMailTransportOptions(config:OfferMailConfig){
 return {host:config.host,port:config.port,secure:config.secure,requireTLS:!config.secure,auth:{user:config.user,pass:config.password},tls:{minVersion:'TLSv1.2' as const,rejectUnauthorized:true},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true};
}
// Durable deduplication is separate from SMTP. An SMTP error must never make
// an already stored customer request appear to have failed.
export async function deliverOfferNotification(client:SupabaseClient,key:string,send:()=>Promise<boolean>){
 const claim=await client.rpc('claim_offer_request_mail',{p_key:key});
 if(claim.error)throw Error('notification_claim_failed');
 if(typeof claim.data!=='string')return 'duplicate' as const;
 let accepted=false;try{accepted=await send();}catch{/* No provider error text or credentials in logs. */}
 const finish=await client.rpc('finish_offer_request_mail',{p_key:key,p_token:claim.data,p_accepted:accepted});
 if(finish.error)throw Error('notification_receipt_failed');
 return accepted?'accepted' as const:'failed' as const;
}
