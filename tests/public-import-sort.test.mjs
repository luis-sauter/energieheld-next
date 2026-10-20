import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){if(s.startsWith('@/'))return next(new URL('../src/'+s.slice(2)+'.ts',import.meta.url).href,c);return next(s,c);}});
const {filterTravelListings,travelFilterUrl}=await import('../src/lib/reiseportal-facets.ts');
const {readTravelFilterValues,activeTravelFilterLabels}=await import('../src/lib/reiseportal-filter-options.ts');
const {publicImportPresentation}=await import('../src/config/import-presentation.ts');
const item=(id,name,importedAt,country='Deutschland')=>({id,name,importedAt,categoryIds:[],services:[],description:'',tagline:'',slug:id,travelTermKeys:['theme:nordic-walking','audience:paare'],location:{city:'Berlin',postalCode:'10115',region:'',country}});
const rows=[item('a','Alpha'),item('b','Beta','2026-10-10T00:00:00Z'),item('c','Gamma','2026-10-11T00:00:00Z'),item('d','Delta','2026-10-11T00:00:00Z','Österreich')];
test('new-import sort uses persistent dates, stable name ties, existing filters and URL roundtrip',()=>{
 const before=publicImportPresentation.enabled;
 try{publicImportPresentation.enabled=true;
 const values=readTravelFilterValues({sort:'imported',thema:'nordic-walking',zielgruppe:'paare'});
 assert.deepEqual(filterTravelListings(rows,values).map(i=>i.id),['d','c','b','a']);
 assert.deepEqual(filterTravelListings(rows,{...values,destination:'deutschland'}).map(i=>i.id),['c','b','a']);
 assert.match(travelFilterUrl(values),/sort=imported/);
 assert.ok(activeTravelFilterLabels(values,{themes:[],destinations:[],audiences:[],accommodations:[],features:[]}).includes('Sortierung: Neu importiert zuerst'));
 assert.deepEqual(filterTravelListings(rows,{...values,sort:'name'}).map(i=>i.id),['a','b','d','c']);
 assert.deepEqual(rows.map(i=>i.id),['a','b','c','d']);
 }finally{publicImportPresentation.enabled=before;}
});
test('public import sorting is disabled by default without deleting provenance',()=>{
  assert.equal(publicImportPresentation.enabled,false);
  assert.equal(readTravelFilterValues({sort:'imported',ziel:'deutschland'}).sort,'');
  assert.deepEqual(filterTravelListings(rows,readTravelFilterValues({sort:'imported'})).map(i=>i.id),['a','b','c','d']);
  assert.ok(rows[1].importedAt);
});
