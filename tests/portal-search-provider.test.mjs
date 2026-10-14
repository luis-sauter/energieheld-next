import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import './helpers/load-ts.mjs';
let calls=[];globalThis.__searchClient={rpc:async(name,args)=>{calls.push({name,args});return {data:{total:80,hits:[{id:'profile',title:'Camping Rendez-vous',url:'/unterkuenfte/camping',excerpt:'Pool und Hunde willkommen',rank:1000}],catalog_hits:[{id:'natur',type:'theme',title:'Natur pur',url:'/mottoreisen/natur-pur',excerpt:'Natururlaub',rank:600}],ads:[],presentations:[]},error:null}}};
registerHooks({resolve(s,c,next){if(s==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};return next(s,c);},load(u,c,next){if(u.endsWith('/src/lib/supabase/public.ts'))return {format:'module',shortCircuit:true,source:'export const createPublicClient=()=>globalThis.__searchClient;'};if(u.endsWith('/src/lib/portal-search-catalog.ts'))return {format:'module',shortCircuit:true,source:'export const portalSearchCatalog=()=>[];'};return next(u,c);}});
const {searchPortal,portalSearchFilters,accommodationSearchOnly}=await import('../src/lib/portal-search.ts');
const blank={destination:'',theme:'',audience:'',accommodation:'',feature:'',query:'',location:'',sort:''};
test('one RPC, bounded prefix, original query preserved and public results keep distinct types',async()=>{calls=[];const r=await searchPortal(' Camping Rendez-vous ',{page:2});assert.equal(calls.length,1);assert.equal(calls[0].name,'search_public_portal_v2');assert.equal(calls[0].args.p_limit,40);assert.equal(calls[0].args.p_offset,0);assert.equal(r.query,'Camping Rendez-vous');assert.equal(r.total,81);assert.ok(calls[0].args.p_filters);});
test('structured filters force accommodation scope and DB pagination, never post-filter a truncated set',async()=>{calls=[];const filters={...blank,audience:'mit-hund',destination:'oesterreich',sort:'name'};const r=await searchPortal('Pool',{filters,type:'destination',page:3});assert.equal(r.type,'accommodation');assert.equal(r.total,80);assert.equal(r.hits.length,1);assert.equal(r.hits[0].type,'accommodation');assert.equal(calls[0].args.p_limit,20);assert.equal(calls[0].args.p_offset,40);assert.deepEqual(calls[0].args.p_filters,{destination:'oesterreich',theme:'',audience:'mit-hund',accommodation:'',location:'',sort:'name'});});
test('retired feature filter never changes scope; safe empty/punctuation does not call DB; unavailable schema does not fake incomplete hits',async()=>{assert.equal(accommodationSearchOnly({...blank,feature:'barrierefrei'}),false);assert.equal(accommodationSearchOnly({...blank,location:'   '}),false);assert.equal(portalSearchFilters({...blank,sort:'forged'}).sort,'');calls=[];assert.equal((await searchPortal('!!!')).total,0);assert.equal(calls.length,0);const previous=globalThis.__searchClient;globalThis.__searchClient={rpc:async()=>({error:{code:'PGRST202'},data:null})};assert.ok((await searchPortal('Pool')).error);globalThis.__searchClient=previous;});


test('accommodation total survives mixed content, type tabs and pagination without another RPC',async()=>{
 for(const page of [1,2,7])for(const type of [undefined,'accommodation','theme','destination','ad']){
  calls=[];const result=await searchPortal('Wellness',{page,type});
  assert.equal(result.accommodationTotal,80);assert.equal(calls.length,1);
  assert.ok(result.hits.length<=20);
 }
});
test('query cases forward the exact profile count; empty and failure never fake a completed count',async()=>{
 const previous=globalThis.__searchClient;
 try{for(const [query,count] of [['Pension Sonnenhof',1],['Sonn',1],['Wellness',127],['Österreich',8],['zzzzkeinetreffer',0]]){
  calls=[];globalThis.__searchClient={rpc:async(name,args)=>{calls.push({name,args});return {data:{total:count,hits:[],catalog_hits:[],ads:[],presentations:[]},error:null};}};
  const result=await searchPortal(query,{filters:{...blank,destination:'oesterreich'}});
  assert.equal(result.accommodationTotal,count);assert.equal(calls.length,1);assert.equal(calls[0].args.p_filters.destination,'oesterreich');assert.equal(calls[0].args.p_query,query);
 }
 calls=[];assert.equal((await searchPortal('')).accommodationTotal,0);assert.equal(calls.length,0);
 globalThis.__searchClient={rpc:async()=>({data:null,error:{code:'timeout'}})};assert.ok((await searchPortal('Pool')).error);
 }finally{globalThis.__searchClient=previous;}
});


test('stream pagination requests only twenty new profile rows at the consumed offset and retains accommodation total',async()=>{
 calls=[];const result=await searchPortal('Pool',{cursor:{profiles:17,other:1}});assert.equal(calls.length,1);assert.equal(calls[0].args.p_limit,20);assert.equal(calls[0].args.p_offset,17);assert.equal(result.accommodationTotal,80);assert.ok(result.hits.length<=20);
});
