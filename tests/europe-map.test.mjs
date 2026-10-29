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
  if(specifier==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
  if(specifier==='./supabase/public')return {url:'data:text/javascript,export function createPublicClient(){return {async rpc(name,args){globalThis.__mapCalls.push({name,args});return globalThis.__mapRpcHandler?globalThis.__mapRpcHandler(name,args):globalThis.__mapPages.shift()??{data:[],error:null}}}}',shortCircuit:true};
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
 assert.ok(locations.every(x=>Object.keys(x).filter(k=>k!=='precision').sort().join(',')==='id,lat,lon'));
});
test('a stale local snapshot cannot expose an unpublished or moved public profile',()=>{
 assert.deepEqual(companyMapLocations([]),[]);
 const hafner={id:'6cd02ae2-75ab-4273-8cd8-fc62da38b2db',location:{street:'Brunndobl 16',postalCode:'84364',city:'Bad Birnbach',country:'Deutschland'}};
 assert.equal(companyMapLocations([hafner]).length,1);
 assert.deepEqual(companyMapLocations([{...hafner,isPreview:true}]),[]);
 assert.deepEqual(companyMapLocations([{...hafner,isDemo:true}]),[]);
 assert.deepEqual(companyMapLocations([{...hafner,location:{...hafner.location,street:'Andere Adresse 1'}}]),[]);
});
test('map SSR preserves public count and controls without duplicating every client marker in HTML',()=>{
 const html=renderToStaticMarkup(createElement(EuropeMap,{locations}));
 assert.equal((html.match(/data-location-id=/g)||[]).length,0);
 assert.match(html,new RegExp(locations.length+' belegte Standorte'));
 assert.match(html,/Unsere Unterkünfte im Überblick/);
 assert.match(html,/Karte vergrößern/);assert.match(html,/Karte zurücksetzen/);
 assert.match(html,/href="\/reiseportal\/maps\/europe.svg"/);
 assert.doesNotMatch(html,/Hofgut|Google|Mapbox|MapTiler|nominatim|tile\.openstreetmap|<input|<select|dialog/);
 const svg=readFileSync(new URL('../public/reiseportal/maps/europe.svg',import.meta.url),'utf8');
 assert.ok(Buffer.byteLength(svg)<150000);assert.doesNotMatch(svg,/<script|<image|href=/);
});
test('homepage keeps map placement but does not put the Basic dataset or its queries on the page request',()=>{
 const home=readFileSync(new URL('../src/app/(energieheld)/page.tsx',import.meta.url),'utf8');
 assert.match(home,/<AutumnShowcase listings=\{directory.database\} \/>\s*<NearbyHomeMap \/>/);
 assert.doesNotMatch(home,/companyMapLocations|<EuropeMap/);
 assert.doesNotMatch(home,/loadBasicMapLocations|basic-map-locations\.json|HomeAccommodationMap/);
 const component=readFileSync(new URL('../src/components/portal/europe-map.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(component,/supabase|setInterval/);
 assert.match(component,/if \(!pinsVisible \|\| !loadBasics\) return/);
 assert.match(component,/fetch\('\/api\/map-locations'/);
 const css=readFileSync(new URL('../src/components/portal/europe-map.module.css',import.meta.url),'utf8');
 assert.match(css,/touch-action: pan-y pinch-zoom/);assert.doesNotMatch(css,/animation:|transition:/);
});

test('all original 95 verified positions remain byte-for-byte unchanged',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(locations.slice(0,95))).digest('hex'),'82fc31f099b83a83dface35f899c53054764916b33448457806a2b40ed9d5688');
 assert.equal(locations.length,106);
});

test('large public map keeps initial marker HTML bounded for 50000 locations',()=>{
 const large=Array.from({length:50000},(_,i)=>({id:'public-map-'+i,lat:48+(i%100)/1000,lon:11}));
 const html=renderToStaticMarkup(createElement(EuropeMap,{locations:large}));
 assert.ok(Buffer.byteLength(html)<15000,'large marker collections must not inflate the initial HTML');
 assert.match(html,/50000 belegte Standorte/);
 assert.doesNotMatch(html,/data-location-id=/);
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
 assert.equal((html.match(/<use /g)||[]).length,0);
 const component=readFileSync(new URL('../src/components/portal/europe-map.tsx',import.meta.url),'utf8');
 assert.match(component,/M0 0C-2.5-3.5-7-8-7-12a7 7 0 1 1 14 0C7-8 2.5-3.5 0 0Z/);
 assert.match(component,/pen.arc\(0, -12, 2.4/);
 assert.match(html,/viewBox="140 62 1120 496"/);
 assert.match(html,/data-zoom="125"/);
});

test('canvas pins align with SVG slice on desktop/mobile and never sample the 50000-point dataset',async()=>{
 const canvas=await import('../src/lib/map-canvas.ts');
 for(const [width,height]of[[1200,1200*620/1400],[390,300]])for(const view of[geo.INITIAL_MAP_VIEW,geo.zoomMap(geo.INITIAL_MAP_VIEW,.5)]){
  const layout=canvas.canvasMapLayout(view,width,height),point=geo.projectLocation(49,10);
  assert.ok(Math.abs(point[0]*layout.scale+layout.left-((point[0]-view.x)*layout.scale+(width-view.width*layout.scale)/2))<1e-9);
  assert.ok(Math.abs(point[1]*layout.scale+layout.top-((point[1]-view.y)*layout.scale+(height-view.height*layout.scale)/2))<1e-9);
 }
 const source=Array.from({length:50000},(_,i)=>({id:'canvas-'+i,lat:49,lon:10})),points=canvas.projectMapPoints(source);assert.equal(points.length,100000);
 let drawn=0;const context={drawImage(_sprite,x,y,w,h){assert([x,y,w,h].every(Number.isFinite));assert(w>0&&h>0);drawn++;}};
 assert.equal(canvas.paintMapPins(context,{},points,geo.INITIAL_MAP_VIEW,1120,496),50000);assert.equal(drawn,50000);
 const outside=new Float64Array([-100000,-100000]);assert.equal(canvas.paintMapPins(context,{},outside,geo.INITIAL_MAP_VIEW,1120,496),0);
 const html=renderToStaticMarkup(createElement(EuropeMap,{locations:source}));assert.equal((html.match(/<canvas/g)||[]).length,1);assert.doesNotMatch(html,/<use /);assert.match(html,/data-location-count="50000"/);
});

test('map response decoder rejects incomplete/private-shaped or invalid coordinates without discarding valid co-located businesses',async()=>{
 const {decodeBasicMapPoints}=await import('../src/lib/map-canvas.ts');
 assert.equal(decodeBasicMapPoints({total:2,points:[[49,10],[49,10]]}).length,2);
 for(const bad of [null,{total:2,points:[[49,10]]},{total:1,points:[[49,10,42]]},{total:1,points:[{lat:49,lon:10,email:'private'}]},{total:1,points:[[NaN,10]]},{total:1,points:[[49,90]]},{total:1,points:[['49',10]]}])assert.throws(()=>decodeBasicMapPoints(bad));
});

test('strict map reads report failures instead of returning a falsely complete empty result',async()=>{
 const {loadBasicMapLocations}=await import('../src/lib/basic-map-locations.ts');
 globalThis.__mapCalls=[];globalThis.__mapRpcHandler=async()=>({data:null,error:{message:'Unavailable'}});
 try{await assert.rejects(loadBasicMapLocations({strict:true}),/Public map unavailable/);}finally{delete globalThis.__mapRpcHandler;}
});


test('all published Basic coordinates are minimal and live visibility/address guards fail closed',async()=>{
 const {loadBasicMapLocations,basicMapFingerprint}=await import('../src/lib/basic-map-locations.ts');
 const points=JSON.parse(readFileSync(new URL('../src/data/basic-map-locations.json',import.meta.url),'utf8'));
 assert.equal(points.length,36010);assert.equal(new Set(points.map(r=>r.id)).size,36010);
 for(const row of points){assert.deepEqual(Object.keys(row).sort(),['address_fingerprint','id','lat','lon']);assert.ok(Number.isFinite(row.lat)&&Number.isFinite(row.lon));}
 const snapshot=JSON.parse(readFileSync(new URL('../public/reiseportal/data/basic-contacts-20261018-austria-switzerland.json',import.meta.url),'utf8'));
 const contacts=new Map(snapshot.entries.map(r=>[r.id,r]));
 for(const row of points)assert.equal(basicMapFingerprint(contacts.get(row.id).address),row.address_fingerprint);
 globalThis.__mapCalls=[];globalThis.__mapPages=[{data:points.slice(0,2).map(r=>({id:r.id,address:contacts.get(r.id).address})),error:null}];
 const shown=await loadBasicMapLocations();assert.equal(shown.length,2);assert.deepEqual(Object.keys(shown[0]).sort(),['id','lat','lon']);
 globalThis.__mapPages=[{data:[{id:points[0].id,address:{city:'Moved'}}],error:null}];assert.deepEqual(await loadBasicMapLocations(),[]);
 globalThis.__mapPages=[{data:null,error:{message:'Unavailable'}}];assert.deepEqual(await loadBasicMapLocations(),[]);
 globalThis.__mapPages=[{data:[],error:null}];assert.deepEqual(await loadBasicMapLocations(),[]);
 assert.ok(globalThis.__mapCalls.every(r=>r.name==='public_basic_map_contacts'));
});

test('bounded parallel map ranges retain all snapshot points when newer public rows displace a page',async()=>{
 const {loadBasicMapLocations}=await import('../src/lib/basic-map-locations.ts');
 const points=JSON.parse(readFileSync(new URL('../src/data/basic-map-locations.json',import.meta.url),'utf8'));
 const snapshot=JSON.parse(readFileSync(new URL('../public/reiseportal/data/basic-contacts-20261018-austria-switzerland.json',import.meta.url),'utf8'));
 const contacts=new Map(snapshot.entries.map(r=>[r.id,r]));
 const added=Array.from({length:1200},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),address:{city:'Unprojected public fixture'}}));
 const live=[...added,...points.map(r=>({id:r.id,address:contacts.get(r.id).address}))].sort((a,b)=>a.id.localeCompare(b.id));
 let active=0,peak=0;globalThis.__mapCalls=[];
 globalThis.__mapRpcHandler=async(_name,args)=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return{data:live.filter(r=>!args.p_after||r.id>args.p_after).slice(0,1000),error:null};};
 try{const shown=await loadBasicMapLocations();assert.equal(shown.length,points.length);assert.equal(new Set(shown.map(r=>r.id)).size,points.length);assert.ok(peak>1&&peak<=4);assert.ok(globalThis.__mapCalls.length<=200);assert.ok(globalThis.__mapCalls.every(r=>r.args.p_limit===1000));}
 finally{delete globalThis.__mapRpcHandler;}
});
