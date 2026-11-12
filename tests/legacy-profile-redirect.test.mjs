import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){
 if(s==='@/lib/reiseportal-directory')return {shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(`export async function loadReiseportalListingBySlug(slug){if(slug==='offline')return {error:'temporary'};return {data:slug==='missing'?null:{slug:slug==='old-name'?'current-name':slug,isDemo:slug==='demo'}};}`)};
 if(s==='@/lib/seo')return {shortCircuit:true,url:'data:text/javascript,export function indexableProfile(x){return !x.isDemo}'};
 return next(s,c);
}});
const {GET}=await import('../src/app/(energieheld)/unterkuenfte-a-z/liste/[slug]/route.ts');
const request=new Request('http://localhost:3000/old');
test('old profiles return real permanent redirects with relative canonical targets behind a proxy',async()=>{
 const r=await GET(request,{params:Promise.resolve({slug:'old-name'})});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/unterkuenfte/current-name');
 const alias=await GET(request,{params:Promise.resolve({slug:'h%C3%B6flehner'})});assert.equal(alias.headers.get('location'),'/unterkuenfte/hoeflehner');
});
test('unknown and demo profiles are 404, temporary upstream failures are retryable 503',async()=>{
 for(const slug of ['missing','demo','%broken']){const r=await GET(request,{params:Promise.resolve({slug})});assert.equal(r.status,404);assert.equal(r.headers.get('location'),null);assert.equal(r.headers.get('x-robots-tag'),'noindex');}
 const r=await GET(request,{params:Promise.resolve({slug:'offline'})});assert.equal(r.status,503);assert.equal(r.headers.get('retry-after'),'300');
});

test('verified Joomla provider names retain their current canonical identity',async()=>{
 const aliases={"landgasthof-neue-schänke": "landgasthof-neue-schaenke", "rü-blanch": "rue-blanch", "appartementhaus-salzburg-up": "appartementhaus-salzburg", "feldhof": "feldhof-dolcevita-resort", "hotel-salzburger-hof-wanderurlaub": "hotel-salzburger-hof", "jägeralpe": "jaegeralpe", "5-golfurlaub-südtirol-das-golfhotel-andreus": "golfhotel-andreus", "schwarzwälderhof": "schwarzwaelderhof", "der-königsleitner": "der-koenigsleitner-romantik-zu-zweit", "anni´s-romantikhäuschen-in-der-sächsische-schweiz": "anni-romantikhaeuschen", "hotel-ravelli-luxury-spaita": "hotel-ravelli-luxury-spa"};
 for(const [old,current] of Object.entries(aliases)){
  const r=await GET(request,{params:Promise.resolve({slug:encodeURIComponent(old)})});
  assert.equal(r.status,308);assert.equal(r.headers.get('location'),'/unterkuenfte/'+current,old);
 }
});
