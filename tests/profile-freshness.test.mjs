import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
registerHooks({
 resolve(s,c,next){
  if(s==='server-only'||s==='next/cache')return {url:'data:text/javascript,export function revalidatePath(){}',shortCircuit:true};
  if(s.endsWith('.module.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
  if(s==='next/navigation')return {url:'data:text/javascript,export function useRouter(){return {refresh(){}}};export function redirect(){throw Error("DENIED")};export const notFound=redirect',shortCircuit:true};
  if(s==='next/link'||s==='next/image')return {url:`data:text/javascript,export default ${JSON.stringify(s==='next/link'?'a':'img')}`,shortCircuit:true};
  if(s.endsWith('/supabase/server'))return {url:'data:text/javascript,export async function createClient(){return globalThis.freshnessClient}',shortCircuit:true};
  if(s.endsWith('/supabase/public'))return {url:'data:text/javascript,export function createPublicClient(){return globalThis.freshnessPublicClient}',shortCircuit:true};
  if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const e of ['.ts','.tsx'])if(existsSync(new URL(b.href+e)))return next(b.href+e,c);}
  return next(s,c);
 },
 load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(u,c);}
});
const {freshnessStatus,publicFreshnessLabel,freshnessDate,freshnessStates,freshnessCounts,freshnessMatches}=await import('../src/lib/content-freshness.ts');
const {ProfileFreshness}=await import('../src/components/admin/profile-freshness.tsx');
const {ListingDetail}=await import('../src/components/portal/listing-detail.tsx');
const {companyProfileListing}=await import('../src/lib/company-presentation.ts');
const {profileSchema}=await import('../src/lib/seo-schema.ts');
const {siteSeo}=await import('../src/lib/site-seo.ts');
const {reviewInlineProfile,withdrawInlineProfileReview}=await import('../src/app/(energieheld)/experten/[slug]/inline-actions.ts');
const {loadPublicCompanies,loadPublicCompanyBySlug}=await import('../src/lib/public-companies.ts');
const now=new Date('2026-10-04T12:00:00Z');
const initial={content_revision:1,content_updated_at:null,content_update_source:null,reviewed_revision:null,reviewed_at:null};
const checked={...initial,reviewed_revision:1,reviewed_at:'2026-10-04T10:00:00Z'};
test('central withdrawal state, review-need counts and filters share one truth',()=>{
 const required={...checked,review_invalidated_at:'2026-10-04T11:00:00Z'};
 assert.equal(freshnessStatus(required,now),'Prüfung erforderlich');
 const statuses=Object.keys(freshnessStates);
 const counts=freshnessCounts([...statuses,...statuses,undefined]);assert.equal(counts.needsReview,8);
 for(const status of statuses){assert.equal(counts.counts[status],2);assert.equal(freshnessMatches(status,'needs-review'),status!=='Aktuell geprüft');assert.equal(freshnessMatches(status,status),true);assert.equal(freshnessMatches(status,''),true);}
 assert.equal(freshnessMatches(undefined,'needs-review'),false);
});
test('each profile state has contextual action, current review has only secondary withdrawal',()=>{
 const cases=[
  [initial,'Als geprüft markieren',false],
  [{...checked,content_revision:2},'Aktuellen Stand als geprüft markieren',true],
  [{...checked,reviewed_at:'2020-01-01'},'Erneut prüfen',true],
  [checked,null,true],
  [{...checked,review_invalidated_at:'2026-10-04T11:00:00Z'},'Aktuellen Stand als geprüft markieren',false],
 ];
 for(const [state,action,withdraw] of cases){
  const html=renderToStaticMarkup(createElement(ProfileFreshness,{state,review:async()=>({}),withdraw:async()=>({}),disabled:false,compact:true}));
  if(action)assert.ok(html.includes(action));else assert.doesNotMatch(html,/Als geprüft markieren|Aktuellen Stand als geprüft markieren|Erneut prüfen/);
  assert.equal(html.includes('>Prüfung zurückziehen</button>'),withdraw);
 }
 const changed=renderToStaticMarkup(createElement(ProfileFreshness,{state:{...checked,content_revision:2,content_updated_at:'2026-10-04'},review:async()=>({}),disabled:false,compact:true}));
 assert.match(changed,/Geändert: 4. Oktober 2026/);assert.doesNotMatch(changed,/Zuletzt geprüft:/);
});
test('withdrawal server action authorizes target and carries exact expected review snapshot',async()=>{
 for(const options of [{user:false},{admin:false},{matched:false}]){
  globalThis.freshnessClient=client(options);assert.ok((await withdrawInlineProfileReview(listing.id,listing.slug,1,checked.reviewed_at)).error);assert.equal(globalThis.freshnessClient.calls.length,0);
 }
 globalThis.freshnessClient=client();assert.ok((await withdrawInlineProfileReview(listing.id,listing.slug,1,'invalid')).error);assert.equal(globalThis.freshnessClient.calls.length,0);
 assert.ok((await withdrawInlineProfileReview(listing.id,listing.slug,1,checked.reviewed_at)).success);
 assert.deepEqual(globalThis.freshnessClient.calls,[{name:'invalidate_profile_review',args:{p_profile_id:listing.id,p_expected_revision:1,p_expected_reviewed_at:checked.reviewed_at}}]);
 globalThis.freshnessClient=client({error:{code:'PT409'}});assert.match((await withdrawInlineProfileReview(listing.id,listing.slug,1,checked.reviewed_at)).error,/zwischenzeitlich geändert/);
});
test('status priority distinguishes unreviewed, changed, overdue and currently reviewed',()=>{
 assert.equal(freshnessStatus(initial,now),'Noch nicht geprüft');
 assert.equal(freshnessStatus({...checked,content_revision:2,reviewed_at:'2020-01-01'},now),'Seit Prüfung geändert');
 assert.equal(freshnessStatus({...checked,reviewed_at:'2025-10-04T11:59:59Z'},now),'Prüfung überfällig');
 assert.equal(freshnessStatus({...checked,reviewed_at:'2025-10-04T12:00:00Z'},now),'Aktuell geprüft');
 assert.equal(freshnessStatus(checked,now),'Aktuell geprüft');
});
test('twelve calendar months handles leap years; public formatting uses Berlin',()=>{
 assert.equal(freshnessStatus({...checked,reviewed_at:'2024-02-29T12:00:00Z'},new Date('2025-02-28T12:00:00Z')),'Aktuell geprüft');
 assert.equal(freshnessStatus({...checked,reviewed_at:'2024-02-29T12:00:00Z'},new Date('2025-02-28T12:00:01Z')),'Prüfung überfällig');
 assert.equal(freshnessDate('2026-10-03T23:00:00Z'),'4. Oktober 2026');
});
test('public notice is absent without dates and selects precisely one current checked/updated date',()=>{
 assert.equal(publicFreshnessLabel(),null);assert.equal(publicFreshnessLabel({checked_at:null,content_updated_at:null}),null);
 assert.equal(publicFreshnessLabel({checked_at:null,content_updated_at:'2026-10-04'}).label,'Zuletzt aktualisiert');
 assert.equal(publicFreshnessLabel({checked_at:'2025-01-01',content_updated_at:'2024-01-01'}).label,'Zuletzt geprüft');
});
const listing=companyProfileListing({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',slug:'real-hotel',display_name:'Real Hotel',description:'Actual profile text',company_profile_categories:[]},{images:[]});
test('public profile HTML ignores even stale freshness projections and exposes no dates/status/actions',()=>{
 const html=renderToStaticMarkup(createElement(ListingDetail,{listing:{...listing,freshness:{checked_at:'2026-10-04',content_updated_at:'2026-10-03'}},categories:[],presentation:'company'}));
 assert.match(html,/Actual profile text/);
 assert.doesNotMatch(html,/profile-freshness|Zuletzt geprüft|Zuletzt aktualisiert|content_revision|reviewed_revision|Datenqualität|Als geprüft markieren|2026-10-04/);
});
test('review UI stays compact, explicitly separate from save, disabled during pending/unsaved work',()=>{
 const html=renderToStaticMarkup(createElement(ProfileFreshness,{state:initial,review:async()=>({}),disabled:true}));
 assert.match(html,/Noch nicht geprüft/);assert.match(html,/<button[^>]+disabled/);assert.match(html,/Als geprüft markieren/);assert.match(html,/Speichern bestätigt keine Prüfung/);
 assert.doesNotMatch(html,/content_revision|reviewed_revision|user_id/);
});
test('public schema has no freshness projection or invented modification time',()=>{
 const config=siteSeo({SITE_URL:'https://portal.example',NODE_ENV:'production',SITE_INDEXING:'enabled'});
 const page=s=>profileSchema({...listing,freshness:s},[],config).find(x=>x['@type']==='WebPage');
 assert.equal(page({checked_at:'2026-10-04',content_updated_at:null}).dateModified,undefined);
 assert.equal(page({checked_at:'2026-10-04',content_updated_at:'2026-01-01'}).dateModified,undefined);
});
function client({admin=true,user=true,matched=true,error=null}={}){
 const calls=[];return {calls,auth:{getUser:async()=>({data:{user:user?{id:'admin-id'}:null},error:null})},
  from(table){return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='portal_admins'?admin?{user_id:'admin-id'}:null:matched?{id:listing.id}:null,error:null})};},
  rpc:async(name,args)=>{calls.push({name,args});return {error};}};
}
test('review server action rejects anon/owner/mismatched profile or invalid revision before RPC',async()=>{
 for(const options of [{user:false},{admin:false},{matched:false}]){
  globalThis.freshnessClient=client(options);const result=await reviewInlineProfile(listing.id,listing.slug,1);assert.ok(result.error);assert.equal(globalThis.freshnessClient.calls.length,0);
 }
 globalThis.freshnessClient=client();assert.ok((await reviewInlineProfile(listing.id,listing.slug,-1)).error);assert.equal(globalThis.freshnessClient.calls.length,0);
});
test('review server action passes expected revision and reports stale content understandably',async()=>{
 globalThis.freshnessClient=client();assert.ok((await reviewInlineProfile(listing.id,listing.slug,4)).success);
 assert.deepEqual(globalThis.freshnessClient.calls,[{name:'review_profile_content',args:{p_profile_id:listing.id,p_expected_revision:4}}]);
 globalThis.freshnessClient=client({error:{code:'PT409'}});assert.match((await reviewInlineProfile(listing.id,listing.slug,4)).error,/zwischenzeitlich geändert/);
});
test('public directory and detail load no freshness data or RPC',async()=>{
 const row={id:listing.id,slug:listing.slug,status:'approved',display_name:'Real Hotel',company_profile_categories:[],company_profile_images:[]};
 const calls=[];globalThis.freshnessPublicClient={from(table){return {select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:table==='company_profiles'?[row]:[],error:null}),maybeSingle:async()=>({data:row,error:null})};},rpc:async(name,args)=>{calls.push([name,args]);return {data:[{checked_at:null,content_updated_at:'2026-10-04'}],error:null};}};
 const directory=await loadPublicCompanies();assert.equal(directory.error,null);assert.equal(directory.data.length,1);assert.equal(calls.length,0);assert.equal(directory.data[0].freshness,undefined);
 const detail=await loadPublicCompanyBySlug(row.slug);assert.equal(detail.data.freshness,undefined);assert.equal(calls.length,0);
 globalThis.freshnessPublicClient.rpc=async()=>{throw Error('Offline');};const fallback=await loadPublicCompanyBySlug(row.slug);assert.equal(fallback.error,null);assert.equal(fallback.data.freshness,undefined);
});

test('compact profile header reuses review UI while leaving full details only in edit mode',()=>{
 const html=renderToStaticMarkup(createElement(ProfileFreshness,{state:checked,review:async()=>({}),disabled:false,compact:true}));
 assert.match(html,/Aktuell geprüft/); assert.match(html,/Zuletzt geprüft: 4. Oktober 2026/); assert.doesNotMatch(html,/Als geprüft markieren/);
 assert.doesNotMatch(html,/Nächste Prüfung|Speichern allein|Quelle/);
 const editor=readFileSync(new URL('../src/components/admin/inline-profile-editor.tsx',import.meta.url),'utf8');
 assert.match(editor,/adminAction=\{editing \? undefined/); assert.match(editor,/editing && freshness && reviewFreshness/); assert.match(editor,/review=\{reviewFreshness\}[^>]+compact/);
});
