import 'server-only';
import nodemailer from 'nodemailer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {offerMailConfig,offerMailMessage,deliverOfferNotification} from './offer-notification';
export async function notifyOfferRequest(client:SupabaseClient,key:string){
 const config=offerMailConfig(process.env);if(!config)return;
 try{
  const state=await deliverOfferNotification(client,key,async()=>{
   const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:true,auth:{user:config.user,pass:config.password},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
   const result=await transport.sendMail(offerMailMessage(config,key));
   return result.accepted.some(address=>String(address).toLowerCase()===config.to.toLowerCase());
  });
  if(state==='failed')console.error('offer_notification_failed');
 }catch{console.error('offer_notification_unconfirmed');}
}
