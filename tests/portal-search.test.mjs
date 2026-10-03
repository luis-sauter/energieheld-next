import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import './helpers/load-ts.mjs';
import { buildCatalog, publicJsxCopy } from '../scripts/build-portal-search-catalog.mjs';
const { destinations, travelThemes } = await import('../src/data/reiseportal-discovery.ts');
const { searchQuery, normalizeSearch, matchSearchDocument, mergeSearchHits, searchType, searchResultPage } = await import('../src/lib/portal-search-values.ts');
const { publicBannerSearch } = await import('../src/lib/portal-search-banners.ts');
const { legacyBannerPages } = await import('../src/data/legacy-banner-pages.ts');

test('central banner metadata uses DB FTS, deduplicates shared legacy identity and preserves URL overrides',()=>{
 const key='legacy:https://city-apart-dresden.de/';
 const metadata=['/','/unterkuenfte-a-z'].map(path=>({banner_key:key,name:'Öffentlicher neuer Name',body:'Reisekontext',postal_code:'80331',city:'München',categories:'Wellness Familie',path,target_url:'https://city-apart-dresden.de/',rank:150}));
 const settings=[{path:'/',placement:'sidebar_top',size:'large',legacy_hidden:false,legacy_target_url:'https://city-apart-dresden.de/new'}];
 const hits=mergeSearchHits(publicBannerSearch([],settings,'80331 München',[],metadata));
 assert.equal(hits.length,1);assert.equal(hits[0].title,'Öffentlicher neuer Name');assert.match(hits[0].excerpt,/München/);
 assert.deepEqual(publicBannerSearch([],settings,'Old name',[],metadata.map(row=>({...row,rank:0}))),[]);
 assert.deepEqual(publicBannerSearch([],settings,'City Apart',[],[]),[],'no stale static name leaks when DB says not visible');
});

test('case, umlauts, transliteration, ß, punctuation, multiword and prefix search', () => {
  for (const value of ['Österreich', 'Oesterreich', 'ÖSTERREICH']) assert.equal(normalizeSearch(value), 'osterreich');
  assert.equal(normalizeSearch('Straße'), 'strasse');
  const document = { id: 'pension-sonnenhof', title: 'Pension Sonnenhof', body: travelThemes[1].intro, type: 'accommodation', url: '/unterkuenfte/pension-sonnenhof' };
  assert.ok(matchSearchDocument(document, 'PENSION Sonn'));
  assert.ok(matchSearchDocument(document, 'Nordic Walking'));
  assert.equal(matchSearchDocument(document, 'Nordic Dresden'), null);
  assert.equal(matchSearchDocument(document, '!!!'), null);
  assert.equal(matchSearchDocument(document, ''), null);
  assert.equal(searchQuery('x'.repeat(500)).length, 160);
  assert.equal(searchQuery(['private']), '');
  assert.equal(searchType('ad'), 'ad'); assert.equal(searchType('admin'), undefined);
});

test('generated editorial catalog follows actual JSX rather than independently maintained copy', async () => {
  const pages = await buildCatalog();
  assert.equal(pages.length, 8);
  const advertising = pages.find(p => p.url === '/werbung');
  assert.ok(matchSearchDocument({ ...advertising, id: advertising.url, type: 'page' }, 'Werbeplatz Zeitraum'));
  const sample = publicJsxCopy('<div><h1>Öffentlicher Titel</h1><p>Aktuelle Beschreibung</p><Overview intro="Öffentliche Einführung" /></div>');
  assert.match(sample, /Aktuelle Beschreibung/); assert.match(sample, /Öffentliche Einführung/);
  assert.equal(publicJsxCopy('const adminNote="Interne Notiz"; export const metadata={title:"Privat"};'), '');
  for (const entry of [...travelThemes, ...destinations]) assert.ok(matchSearchDocument({ id: entry.slug, title: entry.title, body: entry.intro, url: entry.slug, type: 'page' }, entry.title));
});

test('legacy banners use actual public resolution, hiding, replacement and page-specific display mappings', () => {
  const rows = [];
  const results = mergeSearchHits(publicBannerSearch([], rows, 'City Apart Dresden'));
  assert.equal(results.length, 1); assert.equal(results[0].type, 'ad'); assert.equal(results[0].external, true);
  const all = Object.entries(legacyBannerPages).flatMap(([path, banners]) => banners.filter(b => b.alt.includes('City Apart')).map(b => ({ path, placement: b.placement, size: b.size, legacy_hidden: true, legacy_target_url: null })));
  assert.deepEqual(publicBannerSearch([], all, 'City Apart Dresden'), []);
  const path = '/';
  const settings = all.filter(row => row.path !== path);
  const campaign = { id: 'existing', path, placement: 'sidebar_top', headline: 'Neue Schänke', body_text: null, target_url: 'https://www.neue-schaenke.de/', image_path: null, rank: 0 };
  const replacements = legacyBannerPages[path].filter(banner => banner.alt.includes('City Apart')).map(banner => ({ ...campaign, id: banner.id, placement: banner.placement }));
  assert.deepEqual(publicBannerSearch(replacements, settings, 'City Apart Dresden'), []);
  assert.ok(mergeSearchHits(publicBannerSearch([], [], 'Neue Schänke')).length > 0);
  assert.ok(publicBannerSearch([], [], 'Natur pur').length > 0);
});

test('SSR search UI, noindex follow, ad links and bounded single-RPC provider retain independent finder', async () => {
  const page = await readFile(new URL('../src/app/(energieheld)/suche/page.tsx', import.meta.url), 'utf8');
  const provider = await readFile(new URL('../src/lib/portal-search.ts', import.meta.url), 'utf8');
  assert.match(page, /pageMetadata\(\{[^\n]*noindex: true/); assert.match(page, /method="get"/);
  assert.match(page, /htmlFor="portal-query"/); assert.match(page, /sponsored noopener noreferrer/);
  assert.match(page, /travelSearchReturnUrl/); assert.doesNotMatch(page, /use client|dangerouslySetInnerHTML/);
  assert.equal((provider.match(/\.rpc\(/g) ?? []).length, 1); assert.doesNotMatch(provider, /signAdImages|loadReiseportalDirectory|createSigned/);
});

test('type filters, deduplication and pagination retain global relevance and accurate totals', () => {
  const profiles = Array.from({ length: 40 }, (_, i) => ({ id: String(i), type: 'accommodation', title: `Profil ${i}`, rank: 900 - i, excerpt: '', url: `/unterkuenfte/${i}` }));
  const destination = { id: 'oesterreich', type: 'destination', title: 'Österreich', rank: 1000, excerpt: '', url: '/reiseziele/oesterreich' };
  const other = [destination, destination];
  const first = searchResultPage(profiles, other, 60, undefined, 1);
  const second = searchResultPage(profiles, other, 60, undefined, 2);
  assert.equal(first.total, 61); assert.equal(first.hits.length, 20); assert.equal(first.hits[0].id, 'oesterreich');
  assert.equal(second.hits.length, 20); assert.equal(second.hits[0].id, '19');
  assert.equal(new Set([...first.hits, ...second.hits].map(hit => hit.id)).size, 40);
  assert.deepEqual(searchResultPage(profiles, other, 60, 'destination', 1), { total: 1, hits: [destination] });
  assert.equal(searchResultPage(profiles, other, 60, 'accommodation', 2).hits[0].id, '20');
  assert.deepEqual(searchResultPage(profiles, other, 60, 'ad', 1), { total: 0, hits: [] });
});

test('active campaigns are searchable by their actual public rubric without catalog duplication', () => {
  const ad = { id: 'existing', path: '/mottoreisen/wellnessangebote', placement: 'sidebar_top', headline: 'Neue Schänke', body_text: null, target_url: 'https://www.neue-schaenke.de/', image_path: null, rank: 0 };
  const hits = publicBannerSearch([ad], [], 'Neue Wellness', []);
  assert.ok(hits.some(hit => hit.id === 'campaign:existing'));
  assert.ok(!publicBannerSearch([ad], [], 'Interne Buchungsdaten', []).some(hit => hit.id === 'campaign:existing'));
});
