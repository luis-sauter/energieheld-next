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
  for(const [name,value] of Object.entries(portalColors))assert.equal(portalColorVariables['--portal-'+name],value);
  assert.match(read('src/app/(energieheld)/layout.tsx'),/\.\.\.portalColorVariables/);
});
test('exact orange/white is the approved choice, honestly below AA; focus and body text retain contrast',()=>{
  assert.ok(Math.abs(contrast(portalColors.orange,portalColors.white)-2.3372)<0.001);
  assert.ok(contrast(portalColors.orange,portalColors.white)<4.5);
  assert.equal(Object.keys(portalColors).length,6);
  const css=read('src/app/globals.css');
  for(const name of ['button','button-hover','button-active'])assert.ok(css.includes(`--portal-${name}: var(--portal-orange);`));
  for(const background of ['white','light-gray','light-orange'])assert.ok(contrast(portalColors.blue,portalColors[background])>=3);
  assert.ok(contrast(portalColors.basalt,portalColors.white)>=4.5);
});
test('legacy button overrides use the approved brand tokens without touching dimensions or image rendering',()=>{
  const rows=read('src/components/portal/directory-listing-rows.module.css');
  assert.match(rows,/listing-row--premium \.row-profile-link\) \{ background: var\(--portal-button\); color: var\(--portal-white\)/);
  const directory=read('src/components/portal/travel-directory.module.css');
  assert.match(directory,/reise-finder-submit\) \{ background: var\(--portal-button\); color: var\(--portal-white\)/);
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
