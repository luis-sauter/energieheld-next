import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {existsSync} from 'node:fs';import './helpers/load-ts.mjs';
registerHooks({resolve(s,c,next){if(s==='server-only')return {url:'data:text/javascript,export{}',shortCircuit:true};if(s.startsWith('@/')){const u=new URL('../src/'+s.slice(2),import.meta.url);for(const ext of ['.ts','.tsx'])if(existsSync(new URL(u.href+ext)))return next(u.href+ext,c);}return next(s,c);},load(u,c,next){if(u.endsWith('/src/lib/supabase/public.ts'))return {format:'module',shortCircuit:true,source:'export const createPublicClient=()=>globalThis.basicSearchMock;'};return next(u,c);}});
const {searchMixedAccommodations,loadAccommodationPage,readAccommodationCursor}=await import('../src/lib/basic-public-search.ts');
const {readBasicContact}=await import('../src/lib/basic-contact.ts');
const {saveAdminBasicCategories}=await import('../src/lib/admin-basic-accommodations.ts');
const filters={destination:'',theme:'',audience:'',accommodation:'',query:'',feature:'',location:'',sort:''};
const basic=i=>({kind:'basic',id:'10000000-0000-4000-8000-'+String(i).padStart(12,'0'),name:'Testpension '+i,address:{city:'Testort',region:'Bayern',country:'DE',houseNumber:'7',postalCode:'01234'},phone:'+49800000000'});
function mock(){const calls=[];globalThis.basicSearchMock={rpc(name,args){calls.push({name,args});const start=args.p_cursor?Number(args.p_cursor.id.slice(-12)):0,rows=Array.from({length:25},(_,i)=>basic(i+1));const response={data:{total:25,items:args.p_count_only?[]:rows.slice(start,start+20).map(entry=>({entry,after:{scope:'database-scope',tier:2,order:0,text:'',name:entry.name,id:entry.id}})),hasMore:!args.p_count_only&&start+20<25,facets:{}},error:null};const request=Promise.resolve(response);request.abortSignal=()=>request;return request;}};return calls;}
test('mixed stream consumes partial accommodation prefixes exactly once and count uses identical deduplicated context',async()=>{
 const calls=mock(),context=async()=>[{id:'topic',type:'theme',title:'Thema',url:'/mottoreisen/natur-pur',rank:600,excerpt:''}];
 const first=await searchMixedAccommodations('Test',{},context);assert.equal(first.hits.length,20);assert.equal(first.hits[0].type,'theme');assert.equal(first.total,26);assert.ok(first.nextCursor.token);
 const second=await searchMixedAccommodations('Test',{cursor:first.nextCursor},context);assert.equal(second.hits.length,6);assert.equal(second.nextCursor,null);
 assert.equal(new Set([...first.hits,...second.hits].map(h=>h.id)).size,26);assert.equal(calls[1].args.p_cursor.id,basic(19).id);
 const count=await searchMixedAccommodations('Test',{countOnly:true},context);assert.equal(count.total,26);assert.deepEqual(count.hits,[]);assert.equal(calls.at(-1).args.p_count_only,true);
});
test('structured filters exclude catalog/banner calls, enforce scope and never return an incomplete zero on RPC error',async()=>{
 mock();let contexts=0;const context=async()=>{contexts++;return[]};
 const r=await searchMixedAccommodations('Test',{filters:{...filters,theme:'wellnessangebote'},type:'theme'},context);assert.equal(r.type,'accommodation');assert.equal(r.total,25);assert.equal(contexts,0);
 const bad=await searchMixedAccommodations('Other',{cursor:r.nextCursor},context);assert.ok(bad.error);
 globalThis.basicSearchMock={rpc:()=>Promise.resolve({error:{code:'57014'},data:null})};assert.ok((await searchMixedAccommodations('Test',{},context)).error);
});
test('application Basic decoder strips private and profile fields recursively and rejects unusable contacts/cursors',async()=>{
 const input={...basic(1),website:'https://private.invalid',profileUrl:'/unterkuenfte/fake',description:'SECRET',address:{...basic(1).address,email:'private@example.invalid'}};
 const result=readBasicContact(input);assert.doesNotMatch(JSON.stringify(result),/website|private|SECRET|profileUrl|email/);assert.equal(result.address.houseNumber,'7');
 for(const value of [{...basic(1),phone:''},{...basic(1),address:{city:'',region:'Bayern',country:'DE'}},null])assert.throws(()=>readBasicContact(value));
 assert.throws(()=>readAccommodationCursor('x'.repeat(2049)));mock();assert.equal((await loadAccommodationPage('Test')).items.length,20);
});
test('Admin save requires verified server membership, exact eleven themes, unique keys and expected revision before RPC',async()=>{
 let rpc=0,admin=true;const client={auth:{getUser:async()=>({data:{user:{id:'verified-user'}},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:'verified-user'}:null,error:null})})})}),rpc:async()=>{rpc++;return{data:{assignedKeys:['theme:wellnessangebote'],revision:2},error:null}}};
 const id=basic(1).id;
 admin=false;assert.ok((await saveAdminBasicCategories(client,id,1,['theme:wellnessangebote'],'QA')).error);assert.equal(rpc,0);admin=true;
 for(const selected of [['theme:saison-herbst'],['feature:sonderthema'],['theme:tauchurlaub'],['theme:wellnessangebote','theme:wellnessangebote']])assert.ok((await saveAdminBasicCategories(client,id,1,selected,'QA')).error);
 assert.equal(rpc,0);assert.ok((await saveAdminBasicCategories(client,id,1,['theme:wellnessangebote'],'QA')).success);assert.equal(rpc,1);
});

