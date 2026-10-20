import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers/load-ts.mjs';
const { orderMottoItems, mottoGroups, visibleMottoAds } = await import('../src/lib/motto-rows.ts');
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
