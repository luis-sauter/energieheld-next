import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
const {companyMapLocations}=await import('../src/lib/company-map-locations.ts');
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
 const view=geo.zoomMap(geo.INITIAL_MAP_VIEW,.5,{x:.25,y:.75});
 assert.deepEqual(view,{x:175,y:232.5,width:700,height:310});
 assert.deepEqual(geo.zoomMap(view,2),geo.INITIAL_MAP_VIEW);
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
 assert.match(home,/<AutumnShowcase listings=\{directory.database\} \/>\s*<EuropeMap locations=\{companyMapLocations\(directory.database\)\} \/>/);
 assert.equal((home.match(/<EuropeMap/g)||[]).length,1);
 const component=readFileSync(new URL('../src/components/portal/europe-map.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(component,/fetch\(|supabase|setInterval/);
 const css=readFileSync(new URL('../src/components/portal/europe-map.module.css',import.meta.url),'utf8');
 assert.match(css,/touch-action: pan-y pinch-zoom/);assert.doesNotMatch(css,/animation:|transition:/);
});
