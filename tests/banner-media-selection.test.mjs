import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};return n(s,c);}});
await import('./helpers/load-ts.mjs');
const {selectedBannerFile}=await import('../src/lib/banner-media-selection.ts');
const {companySearchCache}=await import('../src/lib/media-library-company-cache.ts');
const {isPubliclyListed}=await import('../src/lib/profile-public-visibility.ts');
test('banner selection downloads bounded original bytes without campaign/Storage writes',async()=>{
 const asset={src:'/known.png',name:'Original',archived_at:null};let calls=0;
 const file=await selectedBannerFile(asset,async(url,options)=>{calls++;assert.equal(url,'/known.png');assert.equal(options.credentials,'omit');return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});});
 assert.equal(file.type,'image/png');assert.equal(file.size,4);assert.equal(calls,1);
 await assert.rejects(selectedBannerFile({...asset,archived_at:'now'},()=>{throw Error('must not fetch');}));
 for(const response of [new Response('bad',{status:404}),new Response('bad',{headers:{'content-type':'image/svg+xml'}}),new Response('x',{headers:{'content-length':'5242881','content-type':'image/png'}})])await assert.rejects(selectedBannerFile(asset,async()=>response));
});
test('bounded dialog cache shares in-flight/repeated queries, preserves pages and retries errors',async()=>{
 let calls=0;const cache=companySearchCache(async(q,p)=>{calls++;return {items:[{id:String(p),display_name:q}],more:false};});
 await Promise.all([cache.get('Sonnen',1),cache.get('sonnen',1)]);assert.equal(calls,1);
 await cache.get('Sonnen',2);assert.equal(calls,2);await cache.get('SONNEN',1);assert.equal(calls,2);
 let failed=0;const retry=companySearchCache(async()=>{failed++;return {items:[],more:false,error:'Unavailable'};});await retry.get('',1);await retry.get('',1);assert.equal(failed,2);
 for(let i=0;i<35;i++)await cache.get(String(i),1);assert.equal(cache.has('Sonnen',1),false);
});
test('visibility defaults to listed, handles object/array relations and never changes status',()=>{
 for(const v of [undefined,null,[],{is_listed:true},[{is_listed:true}]])assert.equal(isPubliclyListed({company_profile_public_visibility:v}),true);
 for(const v of [{is_listed:false},[{is_listed:false}]])assert.equal(isPubliclyListed({company_profile_public_visibility:v}),false);
});
