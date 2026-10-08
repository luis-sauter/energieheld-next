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
function client({admin=true,states=[],profiles=[],error=false}={}){
 const calls=[];return {calls,auth:{getUser:async()=>({data:{user:{id:'admin'}}})},rpc:async()=>({data:[{path:'/',label:'Startseite'},{path:'/reiseziele/deutschland',label:'Deutschland'},{path:'https://evil.example',label:'unsafe'}],error:null}),from(table){
  const q={select(fields){calls.push([table,fields]);return this},eq(k,v){if(k==='status')this.status=v;return this},in(k,ids){this.ids=ids;return this},not(k,op,list){this.excluded=list.slice(1,-1).split(',');return this},order(){return this},maybeSingle:async()=>({data:admin?{user_id:'admin'}:null}),range(a,b){
   if(table==='profile_content_freshness')return Promise.resolve({data:states.slice(a,b+1),error:error?{}:null});
   const rows=profiles.filter(p=>(!this.status||p.status===this.status)&&(!this.ids||this.ids.includes(p.id))&&(!this.excluded||!this.excluded.includes(p.id)));
   return Promise.resolve({data:rows.slice(a,b+1),count:rows.length,error:null});
  }};return q;}};
}
const now=new Date('2026-10-08T12:00:00Z');
const state={profile_id:'checked',content_revision:3,reviewed_revision:3,reviewed_at:'2026-10-01T12:00:00Z',content_updated_at:null,content_update_source:null};
test('internal content review reuses exact Freshness rule, approved-only paging and no media',async()=>{
 const states=[state,{...state,profile_id:'changed',content_revision:4},{...state,profile_id:'withdrawn',review_invalidated_at:'2026-10-02'},{...state,profile_id:'overdue',reviewed_at:'2020-01-01'}];
 const profiles=[...states.map(s=>({id:s.profile_id,status:'approved',display_name:s.profile_id,city:'Real city'})),{id:'missing',status:'approved'},{id:'pending',status:'pending'}];
 const c=client({states,profiles});assert.deepEqual((await loadContentReviewPage(c,true,1,now)).rows.map(p=>p.id),['checked']);
 assert.deepEqual((await loadContentReviewPage(c,false,1,now)).rows.map(p=>p.id),['changed','withdrawn','overdue','missing']);
 const paged=await loadContentReviewPage(client({profiles:Array.from({length:25},(_,i)=>({id:String(i),status:'approved'}))}),false,2,now);assert.equal(paged.count,25);assert.equal(paged.rows.length,5);
 assert.ok(c.calls.every(([,fields])=>!fields.includes('*')&&!/image|media/.test(fields)));
 for(const opts of [{admin:false},{error:true}]){const r=await loadContentReviewPage(client(opts));assert.ok(r.error);assert.equal(r.count,undefined);}
 const many=Array.from({length:501},(_,i)=>({...state,profile_id:String(i)}));const r=await loadContentReviewPage(client({states:many,profiles:[{id:'500',status:'approved'}]}),true,1,now);assert.equal(r.rows[0].id,'500');
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
