import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{registerHooks}from'node:module';import{transpileModule,ModuleKind}from'typescript';
registerHooks({resolve(s,c,next){if(s==='@/lib/basic-map-locations')return{url:'data:text/javascript,export async function loadBasicMapLocations(options){globalThis.__mapOptions=options;globalThis.__mapLoads++;return globalThis.__mapLoad();}',shortCircuit:true};if(s==='@/lib/basic-public-search')return{url:'data:text/javascript,export const basicIntegrationEnabled=()=>globalThis.__mapEnabled;',shortCircuit:true};return next(s,c);},load(url,c,next){if(url.endsWith('/api/map-locations/route.ts'))return{format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext}}).outputText};return next(url,c);}});
const{GET}=await import('../src/app/api/map-locations/route.ts'),request=()=>new Request('https://portal.test/api/map-locations');
test('map endpoint coalesces only concurrent public reads, strips contact fields, and immediately refreshes after withdrawal',async()=>{
 globalThis.__mapEnabled=true;globalThis.__mapLoads=0;let release;
 globalThis.__mapLoad=()=>new Promise(resolve=>{release=resolve;});
 const first=GET(request()),second=GET(request());assert.equal(globalThis.__mapLoads,1);assert.equal(globalThis.__mapOptions.strict,true);assert(globalThis.__mapOptions.signal instanceof AbortSignal);
 release([{id:'public',lat:49,lon:10,name:'Not in geometry transport',phone:'+4912345678',email:'private@example.test'}]);
 for(const response of await Promise.all([first,second])){assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Netlify-CDN-Cache-Control'),'no-store');assert.deepEqual(await response.json(),{total:1,points:[[49,10]]});}
 globalThis.__mapLoad=async()=>[];assert.deepEqual(await(await GET(request())).json(),{total:0,points:[]});assert.equal(globalThis.__mapLoads,2);
});
test('map endpoint fails closed, retries only on a fresh request, and rejects unsupported inputs without data access',async()=>{
 globalThis.__mapEnabled=true;globalThis.__mapLoads=0;globalThis.__mapLoad=async()=>{throw Error('Source unavailable');};
 const failed=await GET(request());assert.equal(failed.status,503);assert(!JSON.stringify(await failed.json()).includes('points'));
 globalThis.__mapLoad=async()=>[{id:'new',lat:48,lon:11}];assert.deepEqual(await(await GET(request())).json(),{total:1,points:[[48,11]]});
 const before=globalThis.__mapLoads;assert.equal((await GET(new Request('https://portal.test/api/map-locations?source=private'))).status,400);
 globalThis.__mapEnabled=false;assert.equal((await GET(request())).status,404);assert.equal(globalThis.__mapLoads,before);
});
