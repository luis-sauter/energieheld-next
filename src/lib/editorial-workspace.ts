import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin } from "./admin-review";
import { freshnessStates, type FreshnessStatus, type ContentFreshness } from "./content-freshness";
import { inlineAdContext } from "./inline-ad-context";
import { berlinToday, type AdCampaign } from "./ad-values";
export type ContentReviewRow = { id:string; display_name:string; city:string|null; freshness?:ContentFreshness|null; review_status:FreshnessStatus };
export async function loadContentReviewPage(client:SupabaseClient,reviewed=false,page=1) {
 try {
  const safePage=Number.isSafeInteger(page)&&page>=1&&page<=100000?page:1;
  // The invoker RPC verifies the admin under RLS; no second auth/table scan.
  const {data,error}=await client.rpc("editorial_content_review_page",{p_reviewed:reviewed,p_page:safePage});
  if(error?.code==="42501")return {error:"Keine Berechtigung.",rows:[] as ContentReviewRow[]};
  if(error||!data||!Number.isSafeInteger(data.count)||data.count<0||!Array.isArray(data.rows)||data.rows.length>20||data.rows.length>data.count)throw Error();
  if(data.rows.some((row:ContentReviewRow)=>!row||typeof row.id!=="string"||typeof row.display_name!=="string"||(row.city!==null&&typeof row.city!=="string")||!Object.hasOwn(freshnessStates,row.review_status)||((row.review_status==="Aktuell geprüft")!==reviewed)))throw Error();
  return {rows:data.rows as ContentReviewRow[],count:data.count as number};
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
