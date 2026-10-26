import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

function load(file, stubs) {
  const loadedModule = { exports: {} };
  vm.runInNewContext(transpileModule(readFileSync(new URL('../src/lib/' + file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText, { module: loadedModule, exports: loadedModule.exports, require: key => stubs[key] ?? {} });
  return loadedModule.exports;
}

test('visible accommodation cards and taxonomy start together, retain totals/cursor and seasonal tags', async () => {
  let resolveTerms, resolveCards;
  const terms = new Promise(resolve => { resolveTerms = resolve; });
  const cards = new Promise(resolve => { resolveCards = resolve; });
  const started = [];
  const { loadBasicDirectoryWindow } = load('public-result-pages.ts', {
    './basic-public-search': {
      readAccommodationCursor: () => null,
      loadAccommodationPage: async () => ({ total: 42, hasMore: true, items: [{ entry: { kind: 'profile', id: 'visible', url: '/unterkuenfte/visible' }, after: { id: 'visible' } }] }),
    },
    './supabase/public': { createPublicClient: () => ({ from: () => ({ select: () => ({ in: (_, ids) => {
      assert.deepEqual(Array.from(ids), ['visible']); started.push('terms'); return terms;
    } }) }) }) },
    './reiseportal-directory': { loadReiseportalSearchListings: async ids => {
      assert.deepEqual(Array.from(ids), ['visible']); started.push('cards'); return cards;
    } },
    './portal-search-values': { compactResultCard: row => row },
  });
  const pending = loadBasicDirectoryWindow({});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, ['terms', 'cards']);
  resolveCards([{ id: 'visible', name: 'Visible', cardImageCrop: { zoom: 1.2 } }]);
  resolveTerms({ data: [{ profile_id: 'visible', term_key: 'theme:skifahren', seasonal_teaser: 'Winter' }], error: null });
  const result = await pending;
  assert.equal(result.total, 42);
  assert.equal(JSON.parse(result.nextCursor).id, 'visible');
  assert.equal(result.items[0].seasonTeasers['theme:skifahren'], 'Winter');
  assert.equal(result.items[0].cardImageCrop.zoom, 1.2);
});

test('only selected unsigned banner creatives are signed once without changing local media or placement', async () => {
  const calls = [];
  const { signSelectedPublicBanners } = load('public-banner-media.ts', {
    './supabase/public': { createPublicClient: () => ({}) },
    './ad-campaigns': { signAdImages: async (_, rows) => {
      calls.push(rows); return rows.map(row => ({ ...row, imageUrl: 'https://media.test/' + row.id }));
    } },
  });
  const first = { id: 'one', placement: 'top_banner', image_path: 'campaigns/one/creative/a.webp', imageUrl: 'public-creative' };
  const local = { id: 'local', placement: 'sidebar_top', imageUrl: '/local.webp' };
  const source = [first, { ...first, placement: 'sidebar_bottom' }, local];
  const output = await signSelectedPublicBanners(source);
  assert.equal(calls.length, 1); assert.equal(calls[0].length, 1);
  assert.equal(output[0].imageUrl, output[1].imageUrl);
  assert.equal(output[1].placement, 'sidebar_bottom'); assert.equal(output[2], local);
  assert.equal(first.imageUrl, 'public-creative');
  await signSelectedPublicBanners([local]); assert.equal(calls.length, 1);
});

test('unavailable selected media is suppressed and never emits the metadata marker as an image URL', async () => {
  const { signSelectedPublicBanners } = load('public-banner-media.ts', {
    './supabase/public': { createPublicClient: () => ({}) },
    './ad-campaigns': { signAdImages: async () => { throw Error('unavailable'); } },
  });
  const [row] = await signSelectedPublicBanners([{ id: 'one', image_path: 'campaigns/one/creative/a.webp', imageUrl: 'public-creative' }]);
  assert.equal(row.imageUrl, undefined); assert.equal(row.suppressed, true);
});
