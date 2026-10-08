import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import './helpers/load-ts.mjs';
registerHooks({resolve(s,c,next){
 if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(s==='next/link')return {url:'data:text/javascript,export default "a"',shortCircuit:true};
 if(s==='next/navigation')return {url:'data:text/javascript,export function redirect(p){throw Error("REDIRECT:"+p)};export function notFound(){throw Error("NOT_FOUND")}',shortCircuit:true};
 if(s.endsWith('.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
 if(s.endsWith('/supabase/server'))return {url:'data:text/javascript,export async function createClient(){return globalThis.workspaceClient}',shortCircuit:true};
 if(s.endsWith('/editorial-queue-server'))return {url:'data:text/javascript,export async function getEditorialQueue(){return globalThis.workspaceQueue}',shortCircuit:true};
 if(s.endsWith('/dashboard-analytics'))return {url:'data:text/javascript,export async function loadAdminMetrics(c,period){if(period!=="gesamt")throw Error("inventory is not a period metric");return {data:{counts:{published:60,ads_active:2,ads_scheduled:1,leads_open:0}}}}',shortCircuit:true};
 if(s.startsWith('@/')){const b=new URL('../src/'+s.slice(2),import.meta.url);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return next(b.href+ext,c);}
 return next(s,c);
},load(u,c,next){if(u.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(u,c);}});
const {loadContentReviewPage,loadBannerWorkspacePages,campaignInlinePage}=await import('../src/lib/editorial-workspace.ts');
const {default:AdminPage}=await import('../src/app/(energieheld)/admin/page.tsx');
const {default:ContentPage}=await import('../src/app/(energieheld)/admin/inhalte/page.tsx');
function client({admin=true,profiles=[],error=false,payload}={}){
 const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async(name,args)=>{
  calls.push([name,args]);
  if(name==='public_banner_search_contexts')return {data:[{path:'/',label:'Startseite'},{path:'/reiseziele/deutschland',label:'Deutschland'},{path:'https://evil.example',label:'unsafe'}],error:null};
  if(!admin)return {error:{code:'42501'}};
  const a=(args.p_page-1)*20;
  return {data:payload??{count:profiles.length,rows:profiles.slice(a,a+20).map(p=>({city:null,review_status:args.p_reviewed?'Aktuell geprüft':'Noch nicht geprüft',...p}))},error:error?{}:null};
 },from(table){if(table!=='portal_admins')throw Error('unexpected table scan '+table);return {select(){return this},eq(){return this},maybeSingle:async()=>({data:admin?{user_id:'admin'}:null})}}};
}
test('content loader uses one bounded RPC, normalizes page and fails explicitly',async()=>{
 const profiles=Array.from({length:21},(_,i)=>({id:String(i),display_name:'Profile '+i}));
 const c=client({profiles});const r=await loadContentReviewPage(c,false,2);assert.equal(r.count,21);assert.equal(r.rows.length,1);
 assert.deepEqual(c.calls,[['editorial_content_review_page',{p_reviewed:false,p_page:2}]]);
 for(const page of [NaN,0,-1,1.5,100001]){const c=client();await loadContentReviewPage(c,true,page);assert.equal(c.calls[0][1].p_page,1);}
 for(const opts of [{admin:false},{error:true},{payload:{count:0,rows:[{}]}},{payload:{count:1,rows:[{id:'1',display_name:'P',city:null,review_status:'invalid'}]}},{payload:{count:21,rows:Array(21).fill({})}},{payload:{count:null,rows:[]}},{payload:{count:1,rows:[{id:'1',display_name:'P',city:null,review_status:'Aktuell geprüft'}]}}]){const r=await loadContentReviewPage(client(opts));assert.ok(r.error);assert.equal(r.count,undefined);}
 const failed=await loadContentReviewPage({rpc:async()=>{throw Error('DB offline')}});assert.match(failed.error,/konnten nicht geladen/);
});
test('inline navigation only for active single campaign; original stays unchanged',()=>{
 const original={id:'same-id',status:'approved',approved_start_date:'2026-10-01',approved_end_date:'2026-10-30',targets:[{target_type:'homepage',category_id:null,placement:'sidebar_bottom'}]};const snapshot=JSON.stringify(original);
 assert.equal(campaignInlinePage(original,'2026-10-08'),'/');
 for(const change of [{status:'pending'},{status:'draft'},{archived_at:'2026-10-07'},{approved_start_date:'2026-11-01'},{approved_end_date:'2026-10-01'},{targets:[...original.targets,...original.targets]},{targets:[{target_type:'trade',category_id:'legacy',placement:'sidebar_top'}]}])assert.equal(campaignInlinePage({...original,...change},'2026-10-08'),null);
 assert.equal(JSON.stringify(original),snapshot);
});
test('workspace renders all three zero-task cards, safe tools and honest inventory',async()=>{
 globalThis.workspaceClient=client();globalThis.workspaceQueue={counts:{profiles:0,advertising:0,verifications:0,total:0},tasks:[]};
 const html=renderToStaticMarkup(await AdminPage({searchParams:Promise.resolve({})}));
 assert.match(html,/Verifizierungsanfragen/);assert.equal((html.match(/Keine offenen Anfragen/g)||[]).length,3);assert.match(html,/href="\/admin\/inhalte"/);assert.match(html,/href="\/"/);assert.doesNotMatch(html,/inhaltspruefung|Banner für Anbieter anlegen|Analytics im gewählten Zeitraum|Impressionen|evil.example/);assert.match(html,/sobald die Erfassung aktiviert ist/);
 globalThis.workspaceQueue={tasks:[],error:'Nicht verfügbar'};const failed=renderToStaticMarkup(await AdminPage({searchParams:Promise.resolve({})}));assert.match(failed,/role="alert"/);assert.doesNotMatch(failed,/Keine offenen Anfragen/);
 const pages=await loadBannerWorkspacePages(client());assert.equal(pages.pages.length,2);assert.ok((await loadBannerWorkspacePages(client({admin:false}))).error);
});
test('internal page defaults to review-needed and links into existing editor; owner blocked',async()=>{
 globalThis.workspaceClient=client({profiles:[{id:'real',status:'approved',display_name:'Real profile'}]});const html=renderToStaticMarkup(await ContentPage({searchParams:Promise.resolve({})}));assert.match(html,/vorschau\?bearbeiten=1/);assert.match(html,/aria-current="page">Prüfung erforderlich/);assert.doesNotMatch(html,/erstmalig freischalten|<img/);
 globalThis.workspaceClient=client({admin:false});await assert.rejects(()=>ContentPage({searchParams:Promise.resolve({})}));
});
