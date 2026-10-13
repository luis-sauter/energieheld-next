import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHash } from 'node:crypto';
registerHooks({
 resolve(specifier,context,next) {
  if(specifier.endsWith('.css')) return {url:'data:text/javascript,export default {}',shortCircuit:true};
  if(specifier.startsWith('@/')||specifier.startsWith('.')) {
   const base=specifier.startsWith('@/')?new URL('../src/'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);
   if(specifier.endsWith('.json'))return next(base.href,context);
   for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,context);
  }
  return next(specifier,context);
 },
 load(url,context,next) {
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+readFileSync(new URL(url),'utf8')};
  if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};
  return next(url,context);
 }
});
const geo=await import('../src/lib/europe-map.ts');
const {EuropeMap}=await import('../src/components/portal/europe-map.tsx');
const {companyMapLocations,publicAdvertiserLocationIds}=await import('../src/lib/company-map-locations.ts');
const locations=JSON.parse(readFileSync(new URL('../src/data/company-locations.json',import.meta.url),'utf8'));

test('Lambert projection aligns central meridian and real European control points',()=>{
 assert.deepEqual(geo.projectLocation(49,10),[700,310]);
 const berlin=geo.projectLocation(52.52,13.405),rome=geo.projectLocation(41.9,12.5),paris=geo.projectLocation(48.8566,2.3522);
 assert.ok(berlin[0]>700&&berlin[1]<310);
 assert.ok(rome[1]>310&&paris[0]<700);
 for(const bad of [[NaN,1],[90,1],[1,181]])assert.throws(()=>geo.projectLocation(...bad),RangeError);
 for(const location of locations) {const [x,y]=geo.projectLocation(location.lat,location.lon);assert.ok(x>=0&&x<=1400&&y>=0&&y<=620);}
});
test('zoom preserves anchor, clamps bounds and supports reversible default reset',()=>{
 const view=geo.zoomMap(geo.FULL_MAP_VIEW,.5,{x:.25,y:.75});
 assert.deepEqual(view,{x:175,y:232.5,width:700,height:310});
 assert.deepEqual(geo.zoomMap(view,2),geo.FULL_MAP_VIEW);
 assert.deepEqual(geo.INITIAL_MAP_VIEW,geo.zoomMap(geo.FULL_MAP_VIEW,.8));
 assert.deepEqual(geo.clampMapView({x:-500,y:2000,width:70,height:31}),{x:0,y:496,width:280,height:124});
});
test('public points require published ID, valid coordinates and unique ID; co-located businesses remain separate',()=>{
 const input=[{id:'public',lat:48,lon:10},{id:'public',lat:49,lon:11},{id:'same-address',lat:48,lon:10},{id:'draft',lat:48,lon:10},{id:'missing',lat:null,lon:10}];
 assert.deepEqual(geo.publicMapLocations(input,new Set(['public','same-address','missing'])),input.slice(0,1).concat(input[2]));
 assert.equal(new Set(locations.map(x=>x.id)).size,locations.length);
 assert.ok(locations.length>0);
 assert.ok(locations.every(x=>Object.keys(x).sort().join(',')==='id,lat,lon'));
});
test('a stale local snapshot cannot expose an unpublished or moved public profile',()=>{
 assert.deepEqual(companyMapLocations([]),[]);
 const hafner={id:'6cd02ae2-75ab-4273-8cd8-fc62da38b2db',location:{street:'Brunndobl 16',postalCode:'84364',city:'Bad Birnbach',country:'Deutschland'}};
 assert.equal(companyMapLocations([hafner]).length,1);
 assert.deepEqual(companyMapLocations([{...hafner,isPreview:true}]),[]);
 assert.deepEqual(companyMapLocations([{...hafner,isDemo:true}]),[]);
 assert.deepEqual(companyMapLocations([{...hafner,location:{...hafner.location,street:'Andere Adresse 1'}}]),[]);
});
test('map SSR includes exact public point count, accessible controls and no point links, names, filters or remote tiles',()=>{
 const html=renderToStaticMarkup(createElement(EuropeMap,{locations}));
 assert.equal((html.match(/data-location-id=/g)||[]).length,locations.length);
 assert.match(html,/Unsere Unterkünfte im Überblick/);
 assert.match(html,/Karte vergrößern/);assert.match(html,/Karte zurücksetzen/);
 assert.match(html,/href="\/reiseportal\/maps\/europe.svg"/);
 assert.doesNotMatch(html,/Hofgut|Google|Mapbox|MapTiler|nominatim|tile\.openstreetmap|<input|<select|dialog/);
 const svg=readFileSync(new URL('../public/reiseportal/maps/europe.svg',import.meta.url),'utf8');
 assert.ok(Buffer.byteLength(svg)<150000);assert.doesNotMatch(svg,/<script|<image|href=/);
});
test('homepage adds only map immediately after the unchanged seasonal component',()=>{
 const home=readFileSync(new URL('../src/app/(energieheld)/page.tsx',import.meta.url),'utf8');
 assert.match(home,/<AutumnShowcase listings=\{directory.database\} \/>\s*<EuropeMap locations=\{companyMapLocations\(directory.database, searchBanners.banners\)\} \/>/);
 assert.equal((home.match(/<EuropeMap/g)||[]).length,1);
 const component=readFileSync(new URL('../src/components/portal/europe-map.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(component,/fetch\(|supabase|setInterval/);
 const css=readFileSync(new URL('../src/components/portal/europe-map.module.css',import.meta.url),'utf8');
 assert.match(css,/touch-action: pan-y pinch-zoom/);assert.doesNotMatch(css,/animation:|transition:/);
});

test('all original 95 verified positions remain byte-for-byte unchanged',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(locations.slice(0,95))).digest('hex'),'82fc31f099b83a83dface35f899c53054764916b33448457806a2b40ed9d5688');
 assert.equal(locations.length,104);
});
test('only public active campaign identities qualify an advertiser without a profile; duplicate campaigns share one site',()=>{
 const register=[{locationId:'advertiser:verified-site',advertiserKey:'domain:example.test',campaignIds:['one','two']}];
 const banner=id=>({banner_key:'campaign:'+id,profile_id:null,advertiser_key:'domain:example.test',commercial:true,ad:{id,source:'campaign',status:'approved',imageUrl:'/existing.webp',approved_start_date:'2026-01-01',approved_end_date:'2026-12-31'}});
 assert.deepEqual([...publicAdvertiserLocationIds([banner('one'),banner('two')],register,'2026-10-13')],['advertiser:verified-site']);
 for(const change of [{archived_at:'2026-10-12'},{status:'paused'},{source:'legacy'},{suppressed:true},{approved_end_date:'2026-10-12'},{approved_start_date:'2026-10-14'},{imageUrl:''}])
  assert.equal(publicAdvertiserLocationIds([{...banner('one'),ad:{...banner('one').ad,...change}}],register,'2026-10-13').size,0);
 assert.equal(publicAdvertiserLocationIds([banner('unknown')],register,'2026-10-13').size,0);
 assert.deepEqual(geo.publicMapLocations([{id:'advertiser:verified-site',lat:48,lon:10},{id:'uncertain',lat:null,lon:null}],publicAdvertiserLocationIds([banner('one')],register,'2026-10-13')),[{id:'advertiser:verified-site',lat:48,lon:10}]);
});
test('a published profile and multiple known domain/campaign aliases produce one marker',()=>{
 const profile={id:'57fb1e86-1acf-490c-8b9e-64f3339dbe96',location:{street:'Prof.-Böhm-Straße 7',postalCode:'94072',city:'Bad Füssing',country:'Deutschland'}};
 const banner=id=>({advertiser_key:'domain:haus-salzburg.de',profile_id:null,ad:{id,source:'campaign',imageUrl:'/existing.webp'}});
 const ads=[banner('f953a524-17ca-4e98-96ef-a3e281e958f9'),banner('2008c537-ea81-4697-b271-69eb91a77b7f')];
 assert.equal(companyMapLocations([profile],ads).length,1);
 assert.equal(companyMapLocations([],ads).length,1,'valid public advertiser can remain when profile is not public');
 assert.equal(companyMapLocations([],[]).length,0,'archived campaigns absent from public projection cannot qualify');
 assert.equal(companyMapLocations([{...profile,location:{...profile.location,street:'Moved 1'}}],ads).length,0);
});
test('shared teardrop marker tip remains the exact projected position and reset uses new initial view',()=>{
 const [x,y]=geo.projectLocation(locations[0].lat,locations[0].lon);
 assert.equal(geo.pinTransform(locations[0],geo.INITIAL_MAP_VIEW),`translate(${x} ${y}) scale(0.8)`);
 const html=renderToStaticMarkup(createElement(EuropeMap,{locations}));
 assert.equal((html.match(/<use /g)||[]).length,104);
 assert.match(html,/d="M0 0C-2.5-3.5-7-8-7-12a7 7 0 1 1 14 0C7-8 2.5-3.5 0 0Z"/);
 assert.match(html,/cx="0" cy="-12" r="2.4"/);
 assert.match(html,/viewBox="140 62 1120 496"/);
 assert.match(html,/data-zoom="125"/);
});
