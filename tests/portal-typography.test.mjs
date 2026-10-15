import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
let parseFont = require('../node_modules/next/dist/compiled/@next/font/dist/fontkit').default;
parseFont = parseFont.default || parseFont;

test('two local, preloaded fonts use swap and metric-adjusted fallbacks on every route', () => {
  const fonts = read('src/app/fonts.ts'), layout = read('src/app/layout.tsx');
  assert.match(fonts, /next\/font\/local/);
  assert.doesNotMatch(fonts, /next\/font\/google|https?:/);
  assert.equal((fonts.match(/display: 'swap'/g) || []).length, 2);
  assert.equal((fonts.match(/preload: true/g) || []).length, 2);
  assert.equal((fonts.match(/adjustFontFallback: 'Arial'/g) || []).length, 2);
  assert.match(fonts, /weight: '700'/);
  assert.match(fonts, /weight: '400 700'/);
  assert.match(layout, /headingFont.variable.*bodyFont.variable/);
});

test('font binaries are licensed WOFF2 with German glyphs and the intended actual weights', () => {
  const files = ['montserrat', 'quicksand'];
  let total = 0;
  for (const name of files) {
    const buffer = readFileSync(new URL(`../src/app/fonts/${name}-latin.woff2`, import.meta.url));
    assert.equal(buffer.subarray(0, 4).toString(), 'wOF2');
    total += buffer.length;
    const font = parseFont(buffer);
    for (const character of 'ÄÖÜäöüß€') assert.ok(font.hasGlyphForCodePoint(character.codePointAt(0)), `${name}: ${character}`);
    if (name === 'montserrat') assert.equal(font['OS/2'].usWeightClass, 700);
    else { assert.ok(font.variationAxes.wght.min <= 400); assert.ok(font.variationAxes.wght.max >= 700); }
    assert.match(read(`src/app/fonts/${name === 'montserrat' ? 'Montserrat' : 'Quicksand'}-OFL.txt`), /SIL OPEN FONT LICENSE/);
    assert.ok(read('src/app/fonts/sources.json').includes(createHash('sha256').update(buffer).digest('hex')));
  }
  assert.equal(total, 47068);
});

test('heading, kicker, body and control roles use central family and weight tokens', () => {
  const css = read('src/app/globals.css');
  assert.match(css, /--font-heading: var\(--font-montserrat\)/);
  assert.match(css, /--font-body: var\(--font-quicksand\)/);
  assert.match(css, /body\s*\{[^}]*font-family: var\(--font-body\);[^}]*font-weight: var\(--font-body-weight\)/s);
  assert.match(css, /button,\s*input,\s*select,\s*textarea\s*\{[^}]*font-family: var\(--font-body\)/s);
  assert.match(css, /:is\(h1, h2, h3, h4, h5, h6, \[role="heading"\]\), \.eyebrow\s*\{[^}]*font-family: var\(--font-heading\);[^}]*font-weight: var\(--font-heading-weight\)/s);
  assert.match(css, /:is\(h1,[^}]*overflow-wrap: anywhere/s);
  for (const component of ['autumn-showcase', 'profile-design-preview', 'offer-request-cta']) {
    assert.match(read(`src/components/portal/${component}.module.css`), /\.eyebrow\s*\{[^}]*font-family: var\(--font-heading\)/);
  }
  assert.match(read('src/components/portal/travel-news.module.css'), /\.category\s*\{[^}]*font-family: var\(--font-heading\)/);
});

test('component styles cannot reintroduce independent font families or external font services', () => {
  function scan(directory) {
    for (const file of readdirSync(new URL('../' + directory, import.meta.url), { withFileTypes: true })) {
      const path = `${directory}/${file.name}`;
      if (file.isDirectory()) scan(path);
      else if (file.name.endsWith('.css')) {
        const css = read(path);
        assert.doesNotMatch(css, /Georgia|Times New Roman|fonts\.googleapis|fonts\.gstatic/i, path);
        for (const declaration of css.matchAll(/font-family\s*:\s*([^;}]+)/g)) {
          assert.match(declaration[1], /^(?:var\(--font-(heading|body|montserrat|quicksand)\)|inherit$)/, path);
        }
        if (path !== 'src/app/globals.css') assert.doesNotMatch(css, /font\s*:[^;}]*\b(?:Arial|Helvetica|serif)\b/i, path);
      }
    }
  }
  scan('src');
});
