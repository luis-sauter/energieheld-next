import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './helpers/load-ts.mjs';
const { portalColors, portalColorVariables } = await import('../src/config/portal-colors.ts');
const { reiseportal } = await import('../src/config/reiseportal.ts');
const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8');
const luminance = hex => {
  const rgb=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255)
    .map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
};
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+0.05)/(Math.min(luminance(a),luminance(b))+0.05);

test('all six corporate colors have one source shared by branding and portal CSS variables',()=>{
  assert.deepEqual(Object.fromEntries(['orange','blue','basalt','light-orange','light-gray','white'].map(k=>[k,portalColors[k]])),
    {orange:'#F7902F',blue:'#13237F',basalt:'#435152','light-orange':'#FDF1E4','light-gray':'#F4F4F4',white:'#FFFFFF'});
  assert.deepEqual(reiseportal.colors,{primary:portalColors.blue,accent:portalColors.orange,surface:portalColors['light-gray']});
  assert.equal(reiseportal.name,'DAS-Reiseportal.com');
  for(const [name,value] of Object.entries(portalColors))assert.equal(portalColorVariables['--portal-'+name],value);
  assert.match(read('src/app/(energieheld)/layout.tsx'),/\.\.\.portalColorVariables/);
});

test('legacy accent aliases, video/season focus and map pins use the exact shared brand orange',()=>{
 const css=read('src/app/globals.css');
 assert.match(css,/--brand-accent: var\(--portal-orange, #F7902F\)/);
 assert.match(css,/--brand-accent-hover: var\(--portal-orange, #F7902F\)/);
 assert.doesNotMatch(css,/#ef970c|#d8860b|#f2a835/i);
 for(const file of ['src/components/portal/portal-video.module.css','src/components/portal/travel-seasons.module.css']){
  assert.match(read(file),/outline: 3px solid var\(--portal-orange\)/);
  assert.doesNotMatch(read(file),/#ff8a4c|#ff8b48/i);
 }
 const map=read('src/components/portal/europe-map.tsx');
 assert.match(map,/getPropertyValue\('--portal-orange'\)/);
 assert.match(map,/\|\| portalColors.orange/);
 assert.match(map,/pen.fillStyle = color/);
 assert.match(read('src/config/energieheld.ts'),/accent: portalColors.orange/);
});
test('white-on-orange primary buttons retain brand accents and meet normal-text contrast',()=>{
  assert.ok(Math.abs(contrast(portalColors.orange,portalColors.white)-2.3372)<0.001);
  assert.ok(Math.abs(contrast(portalColors.basalt,portalColors.white)-8.276)<0.001);
  assert.ok(contrast(portalColors.basalt,portalColors.white)>=4.5);
  assert.ok(Math.abs(contrast(portalColors.orange,portalColors.basalt)-3.5409)<0.001);
  assert.ok(contrast(portalColors.orange,portalColors.basalt)<4.5);
  assert.equal(Object.keys(portalColors).length,6);
  const css=read('src/app/globals.css');
  for(const name of ['button','button-hover','button-active']) {
    const value=css.match(new RegExp(`--portal-${name}: (#[0-9a-f]{6});`))[1];
    assert.ok(contrast(value,portalColors.white)>=4.5);
  }
  assert.ok(css.includes('--portal-button-text: var(--portal-white);'));
  for(const background of ['white','light-gray','light-orange'])assert.ok(contrast(portalColors.blue,portalColors[background])>=3);
  assert.ok(contrast(portalColors.basalt,portalColors.white)>=4.5);
});
test('legacy button overrides use the approved brand tokens without touching dimensions or image rendering',()=>{
  const rows=read('src/components/portal/directory-listing-rows.module.css');
  assert.match(rows,/listing-row--premium \.row-profile-link\) \{ background: var\(--portal-button\); color: var\(--portal-button-text\)/);
  const directory=read('src/components/portal/travel-directory.module.css');
  assert.match(directory,/reise-finder-submit\) \{ background: var\(--portal-button\); color: var\(--portal-button-text\)/);
  assert.doesNotMatch(directory,/background: #ff(?:8a4c|9d69)/i);
  assert.match(read('src/components/portal/company-profile.css'),/\.company-profile \.button-primary \{\s*background: var\(--portal-button, var\(--brand-accent\)\);/);
  const css=read('src/app/globals.css');
  assert.match(css,/\[aria-busy="true"\]\) \{[^}]*opacity: 1; transform: none/);
  assert.match(css,/outline: 3px solid var\(--portal-blue\); outline-offset: 3px/);
  assert.match(css,/--portal-ink: var\(--portal-basalt\)/);
  assert.match(css,/\.reiseportal-shell \.mobile-menu a:not\(\.header-cta\),/);
  assert.doesNotMatch(css,/\.reiseportal-shell \.mobile-menu a,/);
  assert.doesNotMatch(css,/\.reiseportal-shell \.company-profile \.button-primary \{ color: var\(--portal-ink\)/);
});
