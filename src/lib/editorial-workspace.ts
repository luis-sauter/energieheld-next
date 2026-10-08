import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin } from "./admin-review";
import { freshnessStatus, type ContentFreshness } from "./content-freshness";
import { inlineAdContext } from "./inline-ad-context";
import { berlinToday, type AdCampaign } from "./ad-values";
export type ContentReviewRow = { id:string; display_name:string; city:string|null; freshness?:ContentFreshness };
export async function loadContentReviewPage(client:SupabaseClient,reviewed=false,page=1,now=new Date()) {
 if(await checkAdmin(client)!=="admin") return {error:"Keine Berechtigung.",rows:[] as ContentReviewRow[]};
 try {
  const states=new Map<string,ContentFreshness>();
  // Read review metadata only. Reuse the exact existing date/revision rule.
  for(let offset=0;;offset+=500){
   const {data,error}=await client.from("profile_content_freshness").select("profile_id,content_revision,content_updated_at,content_update_source,reviewed_revision,reviewed_at,review_invalidated_at").order("profile_id").range(offset,offset+499);
   if(error||!data)throw Error();
   for(const row of data)states.set(row.profile_id,row);
   if(data.length<500)break;
  }
  const checked=[...states].filter(([,s])=>freshnessStatus(s,now)==="Aktuell geprüft").map(([id])=>id);
  if(reviewed&&!checked.length)return {rows:[] as ContentReviewRow[],count:0};
  let query=client.from("company_profiles").select("id,display_name,city",{count:"exact"}).eq("status","approved");
  if(checked.length)query=reviewed?query.in("id",checked):query.not("id","in","("+checked.join(",")+")");
  const {data,error,count}=await query.order("display_name").order("id").range((page-1)*20,page*20-1);
  if(error||!data||count===null)throw Error();
  return {rows:data.map(row=>({...row,freshness:states.get(row.id)})) as ContentReviewRow[],count};
 }catch{return {error:"Die Inhaltsprüfungen konnten nicht geladen werden. Bitte versuchen Sie es erneut.",rows:[] as ContentReviewRow[]};}
}
export async function loadBannerWorkspacePages(client:SupabaseClient){
 if(await checkAdmin(client)!=="admin")return {error:"Keine Berechtigung.",pages:[] as {path:string;label:string}[]};
 try {
 const {data,error}=await client.rpc("public_banner_search_contexts");
 if(error||!Array.isArray(data))return {error:"Die Bannerseiten konnten nicht geladen werden.",pages:[] as {path:string;label:string}[]};
 return {pages:data.filter((p:{path:string})=>inlineAdContext(p.path,true)).map((p:{path:string;label:string})=>({path:p.path,label:inlineAdContext(p.path)?.label??p.label}))};
 }catch{return {error:"Die Bannerseiten konnten nicht geladen werden.",pages:[] as {path:string;label:string}[]};}
}
// Navigation only: never creates, approves or retargets a campaign.
export function campaignInlinePage(c:AdCampaign,today=berlinToday()){
 if(c.archived_at||c.status!=="approved"||!c.approved_start_date||!c.approved_end_date||c.approved_start_date>today||c.approved_end_date<today||c.targets.length!==1)return null;
 const t=c.targets[0];const path=t.target_type==="homepage"?"/":t.target_type==="experts_directory"?"/unterkuenfte-a-z":t.target_type==="portal_area"?"/"+t.target_key:null;
 return path&&inlineAdContext(path)?path:null;
}
