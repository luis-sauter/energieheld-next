import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit, ScriptTarget } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
  resolve(s,c,next){
   if(s.endsWith('/admin/mediathek/actions'))return {shortCircuit:true,url:'data:text/javascript,export async function searchLibraryProfiles(){throw Error("Unexpected company lookup during directory render")};export async function createLibraryCompany(){throw Error("Unexpected company creation")}'};
   if(s.endsWith('inline-banner-actions'))return {shortCircuit:true,url:'data:text/javascript,export async function loadSearchBannerEditor(){throw Error("Unexpected banner editor request during directory render")}'};
   if(s.endsWith('/admin/werbung/actions'))return {shortCircuit:true,url:'data:text/javascript,export async function lifecycleCampaign(){throw Error("Unexpected banner lifecycle write during directory render")}'};
  if(s==='server-only')return {url:'data:text/javascript,export default {}',shortCircuit:true};
  if(s==='react' && c.parentURL?.endsWith('/travel-directory.tsx'))return {url:'data:text/javascript,export function useState(v){return [v === "" ? globalThis.reviewFilter ?? "" : v,()=>{}]};export function useMemo(f){return f()};export function useEffect(){}',shortCircuit:true};
  if(s.endsWith('.module.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
  if(s==='next/navigation')return {url:'data:text/javascript,export function useRouter(){return {refresh(){}}}',shortCircuit:true};
  if(s==='next/link'||s==='next/image')return {url:`data:text/javascript,export default ${JSON.stringify(s==='next/link'?'a':'img')}`,shortCircuit:true};
  const loaders={
   '@/lib/reiseportal-directory':'loadReiseportalDirectory', '@/lib/public-travel-taxonomy':'loadPublicTravelTerms',
   '@/lib/public-ads':'loadPublicAds', '@/lib/public-sidebar-order':'loadPublicSidebarOrder', '@/lib/inline-advertising-loader':'loadInlineBannerOptions',
  };
  if(loaders[s])return {url:`data:text/javascript,export async function ${loaders[s]}(){return globalThis.directoryFixture[${JSON.stringify(loaders[s])}]}`,shortCircuit:true};
  if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const e of ['.ts','.tsx'])if(existsSync(new URL(b.href+e)))return next(b.href+e,c);}
  return next(s,c);
 },
 load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return next(u,c);}
});
const {TravelDirectory}=await import('../src/components/portal/travel-directory.tsx');
const {DirectoryPage}=await import('../src/components/portal/directory-page.tsx');
const {ListingRow}=await import('../src/components/portal/listing-row.tsx');
const {FreshnessStatus}=await import('../src/components/admin/freshness-status.tsx');
const {loadAdminFreshnessStatuses}=await import('../src/lib/profile-freshness.ts');
const {freshnessStatus}=await import('../src/lib/content-freshness.ts');
const {readTravelFilterValues}=await import('../src/lib/reiseportal-filter-options.ts');
const {companyProfileListing}=await import('../src/lib/company-presentation.ts');
const statuses=['Noch nicht geprüft','Seit Prüfung geändert','Prüfung überfällig','Aktuell geprüft'];
const listings=statuses.map((status,i)=>({...companyProfileListing({id:`profile-${i}`,slug:`hotel-${i}`,display_name:`Hotel ${i}`,country:i===3?'Österreich':'Deutschland',company_profile_categories:[]},{images:[]}),directoryPackage:i===0?'premium':'basic'}));
const statusMap=Object.fromEntries(listings.map((l,i)=>[l.id,statuses[i]]));
function nodes(node, predicate){
 if(!node||typeof node!=='object')return [];
 return [...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>nodes(child,predicate))];
}
function directoryTree(props={}){
 const root=TravelDirectory({initialValues:readTravelFilterValues({}),database:listings.slice(0,3),preview:[listings[3]],terms:[],error:null,ads:[],sidebarOrder:[],hiddenOrderKeys:[],canReorder:false,...props});
 const finder=nodes(root,n=>n.props?.mode==='directory')[0];
 return finder.props.renderFinder(null);
}
test('public/provider directory has no status UI or filter; admin gets text and symbols per real profile',()=>{
 globalThis.reviewFilter='';
 for(const props of [{},{freshnessStatuses:undefined}]){
  const tree=directoryTree(props);
  assert.equal(nodes(tree,n=>n.props?.className==='admin-freshness-filter').length,0);
  assert.ok(nodes(tree,n=>n.type===ListingRow).every(n=>n.props.adminStatus===undefined));
 }
 const tree=directoryTree({freshnessStatuses:statusMap});
 assert.equal(nodes(tree,n=>n.props?.className==='admin-freshness-filter').length,1);
 for(const row of nodes(tree,n=>n.type===ListingRow)){
  assert.equal(row.props.adminStatus.props.status,statusMap[row.props.listing.id]);
  const html=renderToStaticMarkup(createElement(FreshnessStatus,row.props.adminStatus.props));
  assert.match(html,/aria-hidden="true"/); assert.ok(html.includes(statusMap[row.props.listing.id]));
 }
});
for(const status of statuses)test(`admin filter renders only ${status}, preserving actual profile including Demo preview`,()=>{
 globalThis.reviewFilter=status;
 const rows=nodes(directoryTree({freshnessStatuses:statusMap}),n=>n.type===ListingRow);
 assert.deepEqual(rows.map(n=>n.props.listing.id),[listings[statuses.indexOf(status)].id]);
});
test('admin filter intersects travel filters without becoming a public URL facet',()=>{
 globalThis.reviewFilter='Aktuell geprüft';
 assert.equal(nodes(directoryTree({freshnessStatuses:statusMap,initialValues:readTravelFilterValues({ziel:'deutschland'})}),n=>n.type===ListingRow).length,0);
 globalThis.reviewFilter='';
 const rows=nodes(directoryTree({freshnessStatuses:statusMap,initialValues:readTravelFilterValues({ziel:'deutschland'})}),n=>n.type===ListingRow);
 assert.equal(rows.length,3); assert.equal(rows[0].props.listing.directoryPackage,'premium');
 const src=readFileSync(new URL('../src/components/portal/travel-directory.tsx',import.meta.url),'utf8');
 assert.match(src,/travelFilterUrl\(values\)/);assert.doesNotMatch(src,/travelFilterUrl\([^)]*reviewFilter/);
});
test('review-need filter excludes current Demo and overview counts all matching profiles, not just filtered ones',()=>{
 globalThis.reviewFilter='needs-review';
 const tree=directoryTree({freshnessStatuses:statusMap});
 assert.deepEqual(nodes(tree,n=>n.type===ListingRow).map(n=>n.props.listing.id),listings.slice(0,3).map(l=>l.id));
 const overview=nodes(tree,n=>n.props?.className==='admin-freshness-summary')[0];
 const html=renderToStaticMarkup(overview);assert.match(html,/Prüfung erforderlich 3/);
 assert.match(html,/Bereits geprüft 1/);assert.doesNotMatch(html,/Ungeprüft|Geändert|Überfällig|Prüfbedarf/);
});
test('status pill appears beside profile name, never below the CTA',()=>{
 const html=renderToStaticMarkup(createElement(ListingRow,{listing:listings[0],categories:[],href:'/profile',travel:true,adminStatus:createElement(FreshnessStatus,{status:statuses[0]})}));
 assert.ok(html.indexOf('admin-freshness-status')<html.indexOf('row-profile-link'));
 assert.match(html,/<div class="row-heading">[\s\S]*?<h3>[\s\S]*?Prüfung erforderlich[\s\S]*?<\/div>/);
});

test('withdrawn review belongs to the same required group and contributes once',()=>{
 const withdrawnMap={...statusMap,[listings[3].id]:'Prüfung erforderlich'};
 globalThis.reviewFilter='Prüfung erforderlich';
 const tree=directoryTree({freshnessStatuses:withdrawnMap});
 assert.deepEqual(nodes(tree,n=>n.type===ListingRow).map(n=>n.props.listing.id),[listings[3].id]);
 const html=renderToStaticMarkup(nodes(tree,n=>n.props?.className==='admin-freshness-summary')[0]);
 assert.match(html,/Prüfung erforderlich 4/); assert.match(html,/Bereits geprüft 0/);
 globalThis.reviewFilter='needs-review';
 assert.equal(nodes(directoryTree({freshnessStatuses:withdrawnMap}),n=>n.type===ListingRow).length,4);
});
test('single batch query uses central status and projects no revision/actor/date fields',async()=>{
 const rows=statuses.map((_,i)=>({profile_id:listings[i].id,content_revision:i===1?2:1,reviewed_revision:i===0?null:1,reviewed_at:i===0?null:i===2?'2020-01-01':new Date().toISOString()}));
 const calls=[];
 const client={from(t){calls.push(t);return {select(s){calls.push(s);return this},in(k,v){calls.push([k,v]);return Promise.resolve({data:rows,error:null})}}}};
 const result=await loadAdminFreshnessStatuses(client,[...listings.map(l=>l.id),listings[0].id]);
 assert.equal(calls.filter(c=>c==='profile_content_freshness').length,1);
 assert.equal(calls[2][1].length,4);
 for(const row of rows)assert.equal(result[row.profile_id],freshnessStatus({...row,content_updated_at:null,content_update_source:null}));
 assert.doesNotMatch(JSON.stringify(result),/revision|reviewed_at|updated_at|user_id/);
 assert.deepEqual(await loadAdminFreshnessStatuses(client,[]),{});
 assert.equal(calls.length,3);
});
test('server directory performs batch only for verified admin client; public output omits status data',async()=>{
 globalThis.directoryFixture={loadReiseportalDirectory:{database:listings.slice(0,3),preview:[listings[3]],hiddenOrderKeys:[],error:null},loadPublicTravelTerms:[],loadPublicAds:[],loadPublicSidebarOrder:[],loadInlineBannerOptions:undefined};
 const publicPage=await DirectoryPage({mode:'travel',searchParams:Promise.resolve({})});
 const publicDirectory=nodes(publicPage,n=>n.type===TravelDirectory)[0];
 assert.equal(publicDirectory.props.freshnessStatuses,undefined);
 let queries=0;
 const adminClient={from(t){assert.equal(t,'profile_content_freshness');queries++;return {select(){return this},in(k,ids){assert.deepEqual(ids,listings.map(l=>l.id));return Promise.resolve({data:[],error:null})}}}};
 const adminPage=await DirectoryPage({mode:'travel',adminClient,searchParams:Promise.resolve({ziel:'deutschland'})});
 assert.equal(queries,1);assert.deepEqual(nodes(adminPage,n=>n.type===TravelDirectory)[0].props.freshnessStatuses,{});
});
test('admin freshness failure is explicit, never fabricated as unreviewed',()=>{
 globalThis.reviewFilter='';const tree=directoryTree({freshnessStatuses:null});
 assert.equal(nodes(tree,n=>n.props?.role==='alert').length,1);
 assert.equal(nodes(tree,n=>n.type==='select' && n.props.value==='').length,1); // existing sort only
 assert.ok(nodes(tree,n=>n.type===ListingRow).every(n=>n.props.adminStatus===undefined));
});
