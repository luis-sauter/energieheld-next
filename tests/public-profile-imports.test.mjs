import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};return next(s,c);}});
const {withPublicImportMarkers}=await import('../src/lib/public-profile-imports.ts');
const row=id=>({id,isDemo:false,isPreview:false});
test('public loader batches safe RPC only, excludes previews and drops unexpected fields/IDs/dates',async()=>{
 const listings=Array.from({length:1001},(_,i)=>row(String(i)));listings.push({...row('demo'),isDemo:true});
 const calls=[];const client={async rpc(name,args){calls.push({name,ids:args.p_profile_ids});return {data:[...args.p_profile_ids.map(profile_id=>({profile_id,imported_at:'2026-10-11T00:00:00Z',source_url:'private',review_note:'private'})),{profile_id:'demo',imported_at:'2026-10-11T00:00:00Z'},{profile_id:'unexpected',imported_at:'2026-10-11T00:00:00Z'}],error:null};}};
 const result=await withPublicImportMarkers(listings,client);
 assert.deepEqual(calls.map(c=>c.ids.length),[500,500,1]);assert.ok(calls.every(c=>c.name==='public_company_import_markers'));
 assert.equal(result.filter(r=>r.importedAt).length,1001);assert.equal(result.at(-1).importedAt,undefined);
 assert.doesNotMatch(JSON.stringify(result),/private|source_url|review_note/);assert.equal(listings[0].importedAt,undefined);
 const invalid=await withPublicImportMarkers([row('one')],{rpc:async()=>({data:[{profile_id:'one',imported_at:'bad-date'}],error:null})});assert.equal(invalid[0].importedAt,undefined);
});
test('missing additive RPC and empty directory preserve existing profiles, no private-table fallback',async()=>{
 const rows=[row('one')];const log=console.error;console.error=()=>{};
 try{assert.equal(await withPublicImportMarkers(rows,{rpc:async()=>({data:null,error:{code:'PGRST202'}})}),rows);}finally{console.error=log;}
 let called=false;assert.deepEqual(await withPublicImportMarkers([],{rpc:async()=>{called=true;}}),[]);assert.equal(called,false);
});
