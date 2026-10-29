import test from 'node:test';import assert from 'node:assert/strict';import './helpers/load-ts.mjs';
const {validPortalMapData}=await import('../src/lib/portal-map-entries.ts');
test('portal map rejects duplicate identities, bogus coordinates and oversized responses',()=>{
 const entry={id:'00000000-0000-0000-0000-000000000001',lat:48.14,lon:11.58,kind:'basic'};
 const data={entries:[entry],limited:false,overview:false};assert(validPortalMapData(data));
 for(const entries of [[entry,entry],Array(501).fill(entry),[{...entry,id:'-'.repeat(36)}],[{...entry,lat:NaN}],[{...entry,lon:180}],[{...entry,kind:'private'}]])assert.equal(validPortalMapData({...data,entries}),false);
});
const {distanceKm,readNearbyQuery}=await import('../src/lib/nearby-map.ts');
const {excludedAgencyTarget}=await import('../src/lib/travel-provider-eligibility.ts');
const {validateOfferWorkspace,offerWorkspaceFields}=await import('../src/lib/offer-request-workspace.ts');
const {offerImageDownloadName}=await import('../src/lib/offer-image-download.ts');
const {isNewPlacement}=await import('../src/config/new-placements.ts');
test('new placement expires after exactly fourteen days and cannot be inferred from a missing/future date',()=>{
 const start='2026-10-29T10:00:00Z',at=Date.parse(start);
 assert(isNewPlacement(start,at));assert(isNewPlacement(start,at+14*86400000-1));assert.equal(isNewPlacement(start,at+14*86400000),false);
 assert.equal(isNewPlacement(undefined,at),false);assert.equal(isNewPlacement(start,at-1),false);
});
test('download names retain the original JPEG name and cannot turn an image into an executable attachment',()=>{
 assert.equal(offerImageDownloadName('Hotel-Banner.jpeg','jpg','id'),'Hotel-Banner.jpeg');
 assert.equal(offerImageDownloadName('Hotel.exe','png','id'),'Hotel.png');
 assert.equal(offerImageDownloadName(undefined,'webp','id'),'Banner-id.webp');
 assert(!/[\r\n/\\]/.test(offerImageDownloadName('../Bad\r\nName.png','png','id')));
});
test('local map distinguishes 20/50km and rejects non-geographic inputs',()=>{
 const c={lat:48.14,lon:11.58};assert.equal(distanceKm(c,c),0);
 assert(distanceKm(c,{lat:48.34,lon:11.58})>20);assert(distanceKm(c,{lat:48.34,lon:11.58})<50);
 for(const query of ['', '?lat=48&lon=11&radius=500','?lat=NaN&lon=11&radius=20','?lat=91&lon=11&radius=20'])assert.equal(readNearbyQuery(new URL('https://portal.test/'+query)),null);
 assert.deepEqual(readNearbyQuery(new URL('https://portal.test/?lat=48&lon=11&radius=20')),{lat:48,lon:11,radius:20});
});
test('agency exclusion follows exact target identities, not arbitrary accommodation text',()=>{
 for(const u of ['https://www.manta.ch/','https://das-reiseportal.com/unterkuenfte/unternehmen-e02e9d04-1561-40b9-b4e8-9dcf3da513b2','/unterkuenfte/wirodive-tauchreisen'])assert(excludedAgencyTarget(u));
 for(const u of ['https://www.hotel-attersee.at/','https://manta.ch.example.org/','/unterkuenfte/golfhotel-andreus'])assert.equal(excludedAgencyTarget(u),false);
});
test('internal edits validate note lengths, revision and contact/date values',()=>{
 const f=new FormData();for(const key of Object.keys(offerWorkspaceFields))f.set(key,'');f.set('revision','0');f.set('note','Rückruf');assert.ok(validateOfferWorkspace(f).details);
 for(const [key,value]of[['note','x'.repeat(4001)],['revision','-1'],['contact_email','kein-email'],['website','javascript:alert(1)'],['requested_start_date','2026-02-30']]){const copy=new FormData();for(const [k,v]of f)copy.set(k,v);copy.set(key,value);assert.ok(validateOfferWorkspace(copy).error);}
});
