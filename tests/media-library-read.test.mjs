import test from 'node:test';
import assert from 'node:assert/strict';
await import('./helpers/load-ts.mjs');
const {fetchMediaLibraryPage}=await import('../src/lib/media-library-read.ts');
const {readMediaLibraryRequest}=await import('../src/lib/media-library-request.ts');

test('catalog GET validates pagination, type, profile and archived filters',()=>{
 assert.deepEqual(readMediaLibraryRequest(new URLSearchParams()),{profile:null,kind:'',query:'',page:1,archived:false});
 for(const q of ['page=NaN','page=0','page=100001','profile=bad','kind=private','archived=yes','query='+ 'x'.repeat(201)])assert.equal(readMediaLibraryRequest(new URLSearchParams(q)),null);
});
test('catalog read is private, abortable and preserves filters without an action POST',async()=>{
 const old=globalThis.fetch, controller=new AbortController();let seen;
 globalThis.fetch=async(url,options)=>{seen={url,options};return Response.json({items:[],count:0});};
 try {await fetchMediaLibraryPage(null,'video','Berg & See',2,true,controller.signal);
  const q=new URL(seen.url,'https://example.org').searchParams;assert.equal(q.get('query'),'Berg & See');assert.equal(q.get('page'),'2');assert.equal(q.get('archived'),'true');
  assert.equal(seen.options.signal,controller.signal);assert.equal(seen.options.cache,'no-store');assert.equal(seen.options.credentials,'same-origin');
  controller.abort();await assert.rejects(fetchMediaLibraryPage(null,'','',1,false,controller.signal),e=>e.name==='AbortError');
 }finally{globalThis.fetch=old;}
});
