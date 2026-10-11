import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){
 if(s==='server-only') return {url:'data:text/javascript,export {}',shortCircuit:true};
 if(s==='@/lib/supabase/server') return {url:'data:text/javascript,export async function createClient(){return globalThis.__catalogTimingClient;}',shortCircuit:true};
 if(s.startsWith('@/')) return next(new URL('../src/'+s.slice(2)+'.ts',import.meta.url).href,c);
 return next(s,c);
}});
await import('./helpers/load-ts.mjs');
const {GET}=await import('../src/app/api/admin/media-library/route.ts');
function client({admin=true,failure=false,retry=false,signFailure=false}={}){
 let reads=0;const calls=[];
 return {calls,auth:{getUser:async()=>({data:{user:{id:'qa'}},error:null})},
 from(){const q={select(){return q;},eq(){return q;},async maybeSingle(){return {data:admin?{user_id:'qa'}:null,error:null};}};return q;},
 rpc(){calls.push('rpc');reads++;const request=Promise.resolve(failure||retry&&reads===1?{data:null,error:{status:503}}:{data:{count:1,items:[{bucket_id:'company-media',storage_path:'profiles/test/gallery/test.png'}]},error:null});request.abortSignal=()=>request;return request;},
 storage:{from(){return {async createSignedUrls(paths,expiry){calls.push({paths,expiry});return {data:paths.map(path=>({path,signedUrl:'https://private.invalid/preview'})),error:signFailure?{status:403}:null};}};}}
 };
}
test('authorized catalog exposes only request-scoped phase durations and bounded read retry count',async()=>{
 globalThis.__catalogTimingClient=client({retry:true});
 const r=await GET(new Request('https://example.org/api/admin/media-library'));
 assert.equal(r.status,200);assert.equal((await r.json()).count,1);
 assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('vary'),'Cookie');
 const h=r.headers.get('server-timing');assert.match(h,/read_retries;desc="1"/);
 const spans=Object.fromEntries([...h.matchAll(/(access|catalog_rpc|signing|server_total);dur=([\d.]+)/g)].map(m=>[m[1],Number(m[2])]));
 assert.equal(Object.keys(spans).length,4);assert.ok(Object.values(spans).every(n=>n>=0&&Number.isFinite(n)));
 assert.ok(spans.server_total+0.3>=spans.access+spans.catalog_rpc+spans.signing);
 assert.doesNotMatch(h,/qa|profiles|https|token|path/);
 globalThis.__catalogTimingClient=client();
 assert.match((await GET(new Request('https://example.org/api/admin/media-library'))).headers.get('server-timing'),/read_retries;desc="0"/);
});
test('guest/forbidden, invalid input and upstream failure disclose no timings or private previews',async()=>{
 for(const setup of [{admin:false},{failure:true},{signFailure:true}]){
  const c=client(setup);globalThis.__catalogTimingClient=c;const r=await GET(new Request('https://example.org/api/admin/media-library'));
  assert.equal(r.headers.has('server-timing'),false);
  if(!setup.admin&&'admin' in setup){assert.equal(r.status,403);assert.equal(c.calls.length,0);assert.deepEqual((await r.json()).items,[]);}
  if(setup.failure){assert.equal(r.status,503);assert.equal(c.calls.filter(x=>x==='rpc').length,2);assert.deepEqual((await r.json()).items,[]);}
 }
 const r=await GET(new Request('https://example.org/api/admin/media-library?page=0'));assert.equal(r.status,400);assert.equal(r.headers.has('server-timing'),false);
});
