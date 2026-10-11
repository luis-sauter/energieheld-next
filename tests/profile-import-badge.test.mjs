import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
registerHooks({load(u,c,next){if(u.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(u,c)}});
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
const {ProfileImportBadge}=await import('../src/components/admin/profile-import-badge.tsx');
test('admin-projected import badge survives publication without replacing review status',()=>{
 for(const status of ['draft','pending','approved','withdrawn']){
  const html=renderToStaticMarkup(createElement(ProfileImportBadge,{imported:true,status}));
  assert.match(html,/Neu importiert/);assert.doesNotMatch(html,/Prüfung erforderlich|Veröffentlicht/);
 }
});
test('absent private admin provenance renders neither label nor spacer',()=>{
 for(const imported of [false,undefined])assert.equal(renderToStaticMarkup(createElement(ProfileImportBadge,{imported})), '');
});
