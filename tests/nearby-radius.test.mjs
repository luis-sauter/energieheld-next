import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distanceKm,selectNearbyLocations,mapViewportQuery,readNearbyQuery} from '../src/lib/nearby-map.ts';
const locations=JSON.parse(readFileSync(new URL('../src/data/basic-map-locations.json',import.meta.url),'utf8'));

test('20/50/75/100/300km retain real outer locations despite a dense centre and the 500-entry budget',()=>{
 const center={lat:48.12,lon:11.43};
 for(const radius of [20,50,75,100,300]){
  const rows=locations.map(p=>({...p,distance:distanceKm(center,p)})).filter(p=>p.distance<=radius).sort((a,b)=>a.distance-b.distance);
  const selected=selectNearbyLocations(rows,495,{...center,radius});
  assert.equal(selected.length,Math.min(rows.length,495));assert.equal(new Set(selected.map(p=>p.id)).size,selected.length);
  assert(selected.every(p=>rows.includes(p)&&p.distance<=radius));
  assert(Math.max(...selected.map(p=>p.distance))>radius*.9,'outer radius must remain represented at '+radius+'km');
  if(rows.length<=495)assert.deepEqual(selected,rows);
  assert.deepEqual(selectNearbyLocations(rows,495,{...center,radius}),selected);
 }
});

test('spatial selection preserves exact coordinates, handles zero and sparse budgets and never fabricates points',()=>{
 const rows=Array.from({length:800},(_,id)=>({id,lat:48+id/100000,lon:11}));rows.push({id:800,lat:48.5,lon:11.5});
 assert.deepEqual(selectNearbyLocations(rows,0,{lat:48,lon:11,radius:100}),[]);
 const selected=selectNearbyLocations(rows,5,{lat:48,lon:11,radius:100});assert.equal(selected.length,5);assert(selected.includes(rows.at(-1)));assert(selected.every(p=>rows.includes(p)));
 assert.deepEqual(selectNearbyLocations([] ,5,{lat:48,lon:11,radius:100}),[]);
});

test('panning changes the request centre and visible corners determine the bounded radius',()=>{
 const a={lat:48.123456,lon:11.456789}, b={lat:48.4,lon:11.8};
 const first=mapViewportQuery(a,[{lat:48.2,lon:11.6},{lat:48.05,lon:11.3}]);
 const moved=mapViewportQuery(b,[{lat:48.5,lon:11.9},{lat:48.3,lon:11.7}]);
 assert.deepEqual({lat:first.lat,lon:first.lon},{lat:48.123,lon:11.457});
 assert.notDeepEqual(first,moved);
 assert(first.radius>=distanceKm(a,{lat:48.05,lon:11.3}));
 assert.equal(mapViewportQuery(a,[{lat:52,lon:15}]).radius,300);
 assert.equal(mapViewportQuery(a,[a]).radius,1);
 for(const view of [first,moved])assert.deepEqual(readNearbyQuery(new URL('https://portal.test/?'+new URLSearchParams(view))),view);
});
test('viewport API accepts intermediate integer radii but rejects unbounded or malformed requests',()=>{
 for(const radius of [1,7,19,33,84,100,180,300])assert.equal(readNearbyQuery(new URL('https://portal.test/?lat=48&lon=11&radius='+radius)).radius,radius);
 for(const radius of ['0','-1','301','500','NaN','2.5',''])assert.equal(readNearbyQuery(new URL('https://portal.test/?lat=48&lon=11&radius='+radius)),null);
});
