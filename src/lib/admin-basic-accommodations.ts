import type {SupabaseClient} from '@supabase/supabase-js';
import {checkAdmin,isProfileId} from './admin-review';
import type {TravelSaveResult,TravelReviewSnapshot} from './admin-travel-taxonomy';
import {travelThemes} from '@/data/reiseportal-discovery';
export const basicThemeKeys=travelThemes.map(t=>'theme:'+t.slug);
export async function loadAdminBasicCategories(client:SupabaseClient,id:string){
  if(await checkAdmin(client)!=='admin'||!isProfileId(id))return null;
  const {data,error}=await client.rpc('admin_basic_categories',{p_id:id});
  if(error||!data||!Array.isArray(data.terms)||!Array.isArray(data.assignedKeys)||!Number.isSafeInteger(data.revision)||data.revision<1||data.terms.length!==basicThemeKeys.length||data.terms.some((t:{term_key:string})=>!basicThemeKeys.includes(t.term_key)))return null;
  return {id:data.id as string,name:data.name as string,city:data.city as string|null,country:data.country as string|null,snapshot:{terms:data.terms,assignedKeys:data.assignedKeys,proposedKeys:[],revision:data.revision} as TravelReviewSnapshot};
}
export async function saveAdminBasicCategories(client:SupabaseClient,id:string,revision:number,selected:string[],reason:string):Promise<TravelSaveResult>{
  if(await checkAdmin(client)!=='admin')return {error:'Nur Administratoren dürfen Basic-Kategorien ändern.'};
  if(!isProfileId(id)||!Number.isSafeInteger(revision)||revision<1||!Array.isArray(selected)||selected.length>basicThemeKeys.length||new Set(selected).size!==selected.length||selected.some(k=>!basicThemeKeys.includes(k))||typeof reason!=='string'||!reason.trim()||reason.length>1000)return {error:'Die Reiseauswahl oder Begründung ist ungültig.'};
  const {data,error}=await client.rpc('save_admin_basic_categories',{p_id:id,p_revision:revision,p_selected:selected,p_reason:reason.trim()});
  if(error||!data||!Array.isArray(data.assignedKeys)||!Number.isSafeInteger(data.revision))return {error:'Nicht gespeichert. Der Stand kann sich zwischenzeitlich geändert haben. Ihre Auswahl bleibt erhalten; bitte gleichen Sie sie nach dem Neuladen ab.'};
  return {success:'Reisezuordnungen gespeichert.',assignedKeys:data.assignedKeys,revision:data.revision};
}
