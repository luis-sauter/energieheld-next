import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { transpileModule, ModuleKind, JsxEmit, ScriptTarget } from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
registerHooks({
 resolve(s,c,next){
  if(s==='next/link')return {url:'data:text/javascript,export default "a"',shortCircuit:true};
  if(s.endsWith('.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
  if(s.endsWith('/admin-review'))return {url:'data:text/javascript,export async function checkAdmin(c){return c.access};export function isProfileId(v){return /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)}',shortCircuit:true};
  if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(b.href+ext)))return next(b.href+ext,c)}return next(s,c);
 },load(u,c,next){if(/\.tsx?$/.test(u))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return next(u,c)}
});
const {saveAdminTravelTerms,loadAdminTravelTaxonomy}=await import('../src/lib/admin-travel-taxonomy.ts');
const {TravelTaxonomyEditor}=await import('../src/components/admin/travel-taxonomy-editor.tsx');
const {TravelReviewProvider}=await import('../src/components/admin/travel-review-context.tsx');
const {travelFilterPreview,sameTravelKeys}=await import('../src/lib/travel-review-state.ts');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function client(access='admin',error=null){const calls=[];return {access,calls,rpc:async(name,args)=>{calls.push({name,args});return {data:{terms:[],proposedKeys:[],assignedKeys:args.p_terms??[],revision:4},error}}};}
const terms=[{term_key:'audience:paar',dimension:'audience',label:'Paar'},{term_key:'accommodation:hotel',dimension:'accommodation',label:'Hotel'},{term_key:'feature:pool',dimension:'feature',label:'Pool'}];
function html(proposedKeys=[]){return renderToStaticMarkup(createElement(TravelReviewProvider,{snapshot:{terms,assignedKeys:['audience:paar'],proposedKeys,revision:3},saveAction:async()=>({})},createElement(TravelTaxonomyEditor)));}

test('explicit validated admin save sends one atomic snapshot RPC; denied/invalid/offline never success',async()=>{
 const denied=client('forbidden');assert.equal((await saveAdminTravelTerms(denied,id,[],[],[],3)).access,'forbidden');assert.equal(denied.calls.length,0);
 for(const [profile,keys,revision]of [['bad',[],3],[id,['bad;drop'],3],[id,[],NaN],[id,[],0]]){const c=client();assert.ok((await saveAdminTravelTerms(c,profile,keys,[],[],revision)).error);assert.equal(c.calls.length,0)}
 const c=client();assert.ok((await saveAdminTravelTerms(c,id,['audience:paar','audience:paar'],[],['accommodation:hotel'],3)).success);
 assert.deepEqual(c.calls,[{name:'save_profile_travel_assignments',args:{p_profile_id:id,p_terms:['audience:paar'],p_expected_terms:[],p_expected_proposals:['accommodation:hotel'],p_expected_revision:3}}]);
 assert.ok((await saveAdminTravelTerms(client('admin',{}),id,[],[],[],3)).error);
 const loader=client();await loadAdminTravelTaxonomy(loader,id);assert.equal(loader.calls[0].name,'admin_profile_travel_review');assert.equal(loader.calls.length,1);
});

test('editor separates private proposals from historical confirmation, compact grouped checkboxes, saved states and public preview',()=>{
 const rendered=html(['accommodation:hotel']);
 for(const text of ['Vom Gastgeber angegeben','Redaktionelle Entscheidung','So wird die Unterkunft auffindbar','Reisezuordnungen speichern','Mottoreisen','Zielgruppen','Unterkunftsarten','Interne Merkmale','Gastgebervorschlag','Bestätigt und gespeichert'])assert.ok(rendered.includes(text),text);
 assert.equal((rendered.match(/type="checkbox"/g)||[]).length,3);assert.equal((rendered.match(/checked=""/g)||[]).length,1);
 assert.doesNotMatch(rendered,/Zuordnen<\/button>|Entfernen<\/button>|besonderheit=/);
 assert.match(html(),/Der Gastgeber hat noch keine Reisebereiche vorgeschlagen/);assert.match(rendered,/Öffentlich wirksam erst nach Veröffentlichung/);
 const css=readFileSync(new URL('../src/components/admin/admin.module.css',import.meta.url),'utf8');assert.match(css,/\.travelChoices.*repeat\(2, minmax\(0, 1fr\)\)/);assert.match(css,/\.travelChoices, \.travelFilters.*minmax\(0, 1fr\)/);assert.match(css,/\.travelChoice:focus-within/);assert.match(css,/min-height: 64px/);
});

test('preview uses only actual filter routes; internal features have no invisible public filter; sets ignore order/duplicates',()=>{
 const preview=travelFilterPreview(terms,['audience:paar','accommodation:hotel','feature:pool']);
 assert.deepEqual(preview.map(t=>t.href),['/unterkuenfte-a-z?zielgruppe=paar','/unterkuenfte-a-z?unterkunftstyp=hotel',null]);
 assert.equal(sameTravelKeys(['a','b','b'],['b','a']),true);assert.equal(sameTravelKeys(['a'],['b']),false);
});
