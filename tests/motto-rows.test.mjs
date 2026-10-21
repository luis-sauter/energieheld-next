import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers/load-ts.mjs';
const { orderMottoItems, mottoGroups, visibleMottoAds, staticPremiumAds } = await import('../src/lib/motto-rows.ts');
const { travelThemes, historicalTravelThemes } = await import('../src/data/reiseportal-discovery.ts');
const { mottoEditorial } = await import('../src/data/motto-editorial.ts');
const { portalAdSection } = await import('../src/lib/ad-target-areas.ts');

test('per-visit ordering is deterministic for hydration, different across seeds, exhaustive and deduplicated',()=>{
 const profiles=Array.from({length:83},(_,i)=>({id:String(i)}));const original=structuredClone(profiles);
 const a=orderMottoItems([...profiles,profiles[0]],p=>p.id,'first-visit');
 assert.equal(a.length,83);assert.deepEqual(a,orderMottoItems(profiles,p=>p.id,'first-visit'));
 assert.notDeepEqual(a,orderMottoItems(profiles,p=>p.id,'second-visit'));
 assert.deepEqual(new Set(a.map(p=>p.id)),new Set(profiles.map(p=>p.id)));assert.deepEqual(profiles,original);
 assert.deepEqual(mottoGroups(a).flat(),a);assert.deepEqual(mottoGroups(a).map(row=>row.length),[28,28,27]);
 assert.deepEqual(mottoGroups(a,2).map(row=>row.length),[42,41]);
 assert.deepEqual(mottoGroups(a.slice(0,2)).map(row=>row.length),[1,1]);
 assert.deepEqual(mottoGroups([]),[]);
});
test('only occupied valid banner creatives appear, campaign identity deduplicates without changing fixed slots',()=>{
 const ad={id:'one',placement:'sidebar_bottom',target_url:'https://example.org/',imageUrl:'/existing.webp'};
 const source=[ad,{...ad,placement:'sidebar_04'},{...ad,id:'hidden',suppressed:true},{...ad,id:'bad',target_url:'javascript:alert(1)'},{...ad,id:'empty',imageUrl:''}];
 assert.deepEqual(visibleMottoAds(source),[source[1]]);assert.equal(source[0].placement,'sidebar_bottom');
});

test('static Premium selection prefers local campaigns, deduplicates creatives and never revives legacy or hidden content',()=>{
 const a={id:'local',placement:'top_banner',imageUrl:'/one.jpg',image_path:'campaigns/local/one.jpg',target_url:'https://example.org/'};
 const b={...a,id:'second',imageUrl:'/two.jpg',image_path:'campaigns/second/two.jpg'};
 assert.deepEqual(staticPremiumAds([a],[a,{...a,id:'duplicate'},b,{...b,id:'third',image_path:'third'}]),[a,b]);
 assert.deepEqual(staticPremiumAds([],[{...a,source:'legacy'},{...a,suppressed:true},{...a,imageUrl:''},{...a,placement:'sidebar_top'}]),[]);
   assert.deepEqual(staticPremiumAds([],[{...a,id:'870c4024-25ec-4c13-9b8b-180599f145fe'},{...a,id:'7f1c06f6-9946-4f0e-90bc-7fb9499ed010'},{...a,id:'65a74452-e82c-4177-8b72-0227ce30ad6e'}]),[]);
});
test('supplementary Premium creatives vary by page without changing booked placements or duplicating images',()=>{
 const pool=Array.from({length:6},(_,i)=>({id:`premium-${i}`,placement:'top_banner',imageUrl:`/${i}.jpg`,image_path:`campaigns/${i}/creative.jpg`,target_url:'https://example.org/'}));
 const original=structuredClone(pool), local={...pool[0],id:'booked'};
 const results=['natur-pur','radwandern','wellnessangebote','skifahren','familienurlaub'].map(seed=>staticPremiumAds([local],pool,seed));
 for(const result of results){assert.equal(result.length,2);assert.equal(result[0].id,'booked');assert.notEqual(result[0].image_path,result[1].image_path);}
 assert.ok(new Set(results.map(result=>result[1].id)).size>1);
 assert.deepEqual(results[0],staticPremiumAds([local],pool,'natur-pur'));assert.deepEqual(pool,original);
});

test('all eleven active themes have individual optimized art and editorial; historical diving targets remain valid',()=>{
 assert.equal(travelThemes.length,12);assert.equal(historicalTravelThemes.length,12);
 assert.equal(portalAdSection('mottoreisen/tauchurlaub'),'mottoreisen');
 assert.equal(travelThemes.some(theme=>theme.slug==='tauchurlaub'),false);
 assert.deepEqual(Object.keys(mottoEditorial),travelThemes.map(theme=>theme.slug));
 for(const theme of travelThemes){const story=mottoEditorial[theme.slug];const bytes=readFileSync(new URL('../public'+story.image,import.meta.url));
 assert.equal(bytes.subarray(8,12).toString(),'WEBP');assert.ok(bytes.length<400000);
 assert.equal(story.intro.match(/[.!?](?:\s|$)/g).length,3);assert.equal('sections' in story,false);}
 const row=readFileSync(new URL('../src/components/portal/motto-row.tsx',import.meta.url),'utf8');assert.doesNotMatch(row,/setInterval|setTimeout|fetch\(/);assert.match(row,/useRotationMotion/);
 const route=readFileSync(new URL('../src/app/(energieheld)/mottoreisen/[slug]/page.tsx',import.meta.url),'utf8');assert.match(route,/seed=\{randomUUID\(\)\}/);assert.doesNotMatch(route,/ProfileRotation/);
});
