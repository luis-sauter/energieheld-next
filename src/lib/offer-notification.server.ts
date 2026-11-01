import 'server-only';
import nodemailer from 'nodemailer';
import type { SupabaseClient } from '@supabase/supabase-js';
import {offerMailConfig,offerMailMessage,offerMailTransportOptions,deliverOfferNotification} from './offer-notification';
export async function notifyOfferRequest(client:SupabaseClient,key:string){
 const config=offerMailConfig(process.env);if(!config)return;
 try{
  const state=await deliverOfferNotification(client,key,async()=>{
   const transport=nodemailer.createTransport(offerMailTransportOptions(config));
   const result=await transport.sendMail(offerMailMessage(config,key));
   return result.accepted.some(address=>String(address).toLowerCase()===config.to.toLowerCase());
  });
  if(state==='failed')console.error('offer_notification_failed');
 }catch{console.error('offer_notification_unconfirmed');}
}
