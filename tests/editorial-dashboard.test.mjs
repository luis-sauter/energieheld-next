import test from 'node:test';import assert from 'node:assert/strict';import './helpers/load-ts.mjs';
import {readFileSync} from 'node:fs';
const {loadEditorialQueue}=await import('../src/lib/editorial-queue.ts');
const {editorialReviewLabel,freshnessStatus,freshnessMatches}=await import('../src/lib/content-freshness.ts');
function client({admin=true,signed=true,error=false,data={counts:{profiles:1,advertising:1,verifications:0,total:2},tasks:[]}}={}){let calls=0;return{get calls(){return calls},auth:{getUser:async()=>({data:{user:signed?{id:'verified'}:null}})},from(){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:admin?{user_id:'verified'}:null})}},rpc:async name=>{calls++;assert.equal(name,'editorial_work_queue');return{data,error:error?{}:null}}};}
test('queue loader never queries for guest/owner, preserves exact snapshot and fails without fabricated zeros',async()=>{
 for(const options of [{admin:false},{signed:false}]){const c=client(options);const r=await loadEditorialQueue(c);assert.ok(r.error);assert.equal(c.calls,0);assert.equal(r.counts,undefined);}
 const c=client();assert.equal((await loadEditorialQueue(c)).counts.total,2);assert.equal(c.calls,1);
 for(const options of [{error:true},{data:null},{data:{counts:{},tasks:[]}},{data:{counts:{profiles:1,advertising:0,verifications:0,total:0},tasks:[]}}]){const r=await loadEditorialQueue(client(options));assert.ok(r.error);assert.equal(r.counts,undefined);}
});
test('all internal invalid/changed/overdue/never-reviewed reasons map to only two UI states',()=>{
 const base={content_revision:3,content_updated_at:null,content_update_source:null,reviewed_revision:3,reviewed_at:new Date().toISOString()};
 for(const state of [{...base,reviewed_at:null},{...base,content_revision:4},{...base,reviewed_at:'2020-01-01'},{...base,review_invalidated_at:new Date().toISOString()}]){const s=freshnessStatus(state);assert.equal(editorialReviewLabel(s),'Prüfung erforderlich');assert.equal(freshnessMatches(s,'needs-review'),true);assert.equal(freshnessMatches(s,'reviewed'),false);}
 assert.equal(editorialReviewLabel(freshnessStatus(base)),'Bereits geprüft');assert.equal(freshnessMatches(freshnessStatus(base),'reviewed'),true);
 const src=readFileSync(new URL('../src/components/portal/travel-directory.tsx',import.meta.url),'utf8');assert.equal((src.slice(src.indexOf('id="inhaltspruefung"'),src.indexOf('{bannerError &&')).match(/<option value=/g)||[]).filter(Boolean).length,3);assert.doesNotMatch(src,/Object.entries\(freshnessStates\)|Prüfbedarf/);
});
test('dashboard tasks precede statistics and full companies are a separate paginated server route',()=>{
 const source=readFileSync(new URL('../src/app/(energieheld)/admin/page.tsx',import.meta.url),'utf8');assert.ok(source.indexOf('Offene Aufgaben')<source.indexOf('Statistiken &amp; Auswertung'));assert.doesNotMatch(source,/loadReviewOverview|result.profiles|offizielle Gewerke/);assert.match(source,/admin\/firmen[?]ansicht=/);assert.match(source,/getEditorialQueue/);
 const companies=readFileSync(new URL('../src/app/(energieheld)/admin/firmen/page.tsx',import.meta.url),'utf8');assert.match(companies,/editorial_company_page/);assert.match(companies,/p_page:page/);assert.match(companies,/name="q"/);assert.match(companies,/Nächste Seite/);
});
