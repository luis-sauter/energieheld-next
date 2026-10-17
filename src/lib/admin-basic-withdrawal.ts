import type {SupabaseClient} from '@supabase/supabase-js';
import {checkAdmin,isProfileId} from './admin-review';
export type BasicWithdrawalFilter={ids?:string[];priceGroup?:string;importRun?:string;sourceId?:string;ruleVersion?:string};
export type BasicWithdrawalPreview={token:string;count:number;items:{id:string;name:string;revision:number}[]};
export function validWithdrawalFilter(filter:BasicWithdrawalFilter){
 if(!filter||typeof filter!=='object'||Array.isArray(filter)||!Object.keys(filter).length||Object.keys(filter).some(k=>!['ids','priceGroup','importRun','sourceId','ruleVersion'].includes(k)))return false;
 if(filter.ids!==undefined&&(!Array.isArray(filter.ids)||!filter.ids.length||filter.ids.length>100||filter.ids.some(id=>!isProfileId(id))))return false;
 if(filter.priceGroup!==undefined&&!['A','B','C','D'].includes(filter.priceGroup))return false;
 if(filter.importRun!==undefined&&!isProfileId(filter.importRun)||filter.sourceId!==undefined&&!isProfileId(filter.sourceId))return false;
 if(filter.ruleVersion!==undefined&&(typeof filter.ruleVersion!=='string'||!filter.ruleVersion.trim()||filter.ruleVersion.length>100))return false;
 return true;
}
export async function previewBasicWithdrawal(client:SupabaseClient,filter:BasicWithdrawalFilter):Promise<{error?:string;preview?:BasicWithdrawalPreview}>{
 if(await checkAdmin(client)!=='admin'||!validWithdrawalFilter(filter))return {error:'Keine zulässige Admin-Auswahl.'};
 const {data,error}=await client.rpc('preview_basic_withdrawal',{p_filter:filter});
 if(error||!data||!Number.isSafeInteger(data.count)||data.count>100||!Array.isArray(data.items)||data.items.length!==data.count||!/^[a-f0-9]{64}$/.test(data.token))return {error:'Die Auswahl konnte nicht sicher geprüft werden. Bitte grenzen Sie sie auf höchstens 100 öffentliche Basics ein.'};
 return {preview:data};
}
export async function withdrawBasicSelection(client:SupabaseClient,filter:BasicWithdrawalFilter,token:string,reason:string){
 if(await checkAdmin(client)!=='admin'||!validWithdrawalFilter(filter)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||typeof reason!=='string'||!reason.trim()||reason.length>1000)return {error:'Admin-Berechtigung, geprüfte Auswahl und Begründung erforderlich.'};
 const {data,error}=await client.rpc('withdraw_basic_contacts',{p_filter:filter,p_token:token,p_reason:reason.trim()});
 if(error||!data||!Number.isSafeInteger(data.withdrawn)||data.withdrawn<1||data.withdrawn>100)return {error:'Nicht zurückgenommen. Der Datenstand kann sich geändert haben; bitte die Auswahl erneut prüfen.'};
 return {success:`${data.withdrawn} Basic-Unterkünfte zurückgenommen. Die privaten Daten und Belege bleiben erhalten.`};
}
