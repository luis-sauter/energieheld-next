import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers/load-ts.mjs';
const { destinations } = await import('../src/data/reiseportal-discovery.ts');
const { destinationEditorial } = await import('../src/data/destination-editorial.ts');
test('every country has its own optimized editorial landscape without altering accommodation assets', () => {
 assert.deepEqual(Object.keys(destinationEditorial), destinations.map(entry => entry.slug));
 const images = new Set();
 for (const entry of destinations) {
  const art = destinationEditorial[entry.slug];
  images.add(art.image);
  const bytes = readFileSync(new URL('../public' + art.image, import.meta.url));
  assert.equal(bytes.subarray(8,12).toString(), 'WEBP');
  assert.ok(bytes.length < 400000);
  assert.notEqual(art.image, entry.image);
 }
 assert.equal(images.size,4);
});
test('countries reuse motto rendering while preserving destination queries and existing profile data loader', () => {
 const route=readFileSync(new URL('../src/app/(energieheld)/reiseziele/[slug]/page.tsx',import.meta.url),'utf8');
 const detail=readFileSync(new URL('../src/components/portal/motto-detail.tsx',import.meta.url),'utf8');
 assert.match(route,/kind="destination"/);
 assert.match(route,/loadReiseportalDestination\(entry.slug\)/);
 assert.match(route,/loadDiscoveryAdvertising\(`\/reiseziele\/\$\{entry.slug\}`\)/);
 assert.doesNotMatch(route,/DiscoveryDetail|ProfileRotation|BasicContact/);
 assert.match(detail,/destination \? 'ziel' : 'thema'/);
 assert.match(detail,/AccommodationCard[^]*?listing=\{listing\} motto/);
 assert.match(detail,/CampaignSlot/);
 assert.match(detail,/relatedTravelPages\(listings\).themes/);
});
