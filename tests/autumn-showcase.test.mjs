import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
 resolve(specifier, context, next) {
  if (specifier.endsWith('.css')) return { url: 'data:text/javascript,export default ' + encodeURIComponent(JSON.stringify({ section:'section',card:'card',header:'header',editorial:'editorial',photo:'photo',copy:'copy' })), shortCircuit:true };
  if (specifier === 'next/link') return { url:'data:text/javascript,' + encodeURIComponent('import {createElement} from "react";export default function Link({prefetch,...p}){return createElement("a",p)}'), shortCircuit:true };
  if (specifier === 'next/image') return { url:'data:text/javascript,' + encodeURIComponent('import {createElement} from "react";export default function Image({fill,unoptimized,...p}){return createElement("img",p)}'), shortCircuit:true };
  if (specifier === 'react' && context.parentURL?.startsWith('data:')) return next(specifier, {...context,parentURL:import.meta.url});
  if (specifier.startsWith('@/') || specifier.startsWith('.')) {
   const base = specifier.startsWith('@/') ? new URL('../src/' + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
   for (const ext of ['.ts','.tsx']) if (existsSync(new URL(base.href+ext))) return next(base.href+ext,context);
  }
  return next(specifier,context);
 },
 load(url,context,next) {
  if (/\.tsx?$/.test(url)) return { format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText };
  return next(url,context);
 }
});
const { AUTUMN_TERM, AUTUMN_HREF, autumnSelections, selectAutumnStays } = await import('../src/lib/autumn-showcase.ts');
const { AutumnShowcase } = await import('../src/components/portal/autumn-showcase.tsx');
const fixtures = () => autumnSelections.map((entry,index) => ({
 id:entry.profileId,slug:'existing-'+index,name:'Echter Anbieter '+index,isDemo:false,isPreview:false,
 travelTermKeys:[AUTUMN_TERM,'theme:wellnessangebote'],seasonTeasers:{[AUTUMN_TERM]:'Gespeicherter saisonaler Kurztext.'},
 location:{city:'Ort',country:'Österreich'},logo:{src:'/logo.png',alt:'Logo'},
 images:[{id:'unselected',src:'/other.jpg',alt:'Anderes Bild'},{id:entry.imageId,src:'/actual-'+index+'.jpg',alt:'Originalfoto'}]
 }));

test('editorial selection requires current exact autumn assignment and selected existing gallery ID, without mutating media',()=>{
 const listings=fixtures(),before=JSON.stringify(listings);
 assert.equal(selectAutumnStays(listings).length,4);
 assert.equal(selectAutumnStays(listings)[0].image.src,'/actual-0.jpg');
 assert.equal(JSON.stringify(listings),before);
 for(const change of [row=>({...row,travelTermKeys:[]}),row=>({...row,travelTermKeys:['theme:natur-pur','theme:saison-sommer']}),row=>({...row,isDemo:true}),row=>({...row,isPreview:true}),row=>({...row,images:[]}),row=>({...row,images:[row.images[0]]}),row=>({...row,logo:row.images[1]})]) {
  assert.equal(selectAutumnStays([change(listings[0])]).length,0);
 }
 assert.equal(selectAutumnStays([{...listings[0],id:'unselected-pretty-profile'}]).length,0);
 assert.equal(selectAutumnStays([]).length,0);
});

test('reference layout renders one declared AI editorial image, genuine linked cards and existing season CTA as server HTML',()=>{
 const rows=fixtures(),html=renderToStaticMarkup(createElement(AutumnShowcase,{listings:rows}));
 assert.equal((html.match(/data-autumn-profile=/g)||[]).length,4);
 assert.equal((html.match(/src="\/reiseportal\/seasons\/herbst-auszeit.webp"/g)||[]).length,1);
 assert.match(html,/KI-generiertes Symbolbild/);
 assert.match(html,/Herbst-Auszeit mit Charakter/);
 assert.match(html,/Alle Herbst-Unterkünfte/);
 assert.ok(html.includes('href="'+AUTUMN_HREF+'"'));
 for(const row of rows)assert.ok(html.includes('href="/unterkuenfte/'+row.slug+'"'));
 assert.doesNotMatch(html,/Gespeicherter saisonaler Kurztext/);
 assert.doesNotMatch(html,/Panorama Lodge Aurelia|Chalet Kupferlaub|Herbstresidenz Mirabell|Seegut Waldruh|iframe|<button/);
 assert.equal(renderToStaticMarkup(createElement(AutumnShowcase,{listings:[]})),'');
});

test('partial selection collapses absent providers without placeholders; content follows current records',()=>{
 const rows=fixtures(); rows[1].travelTermKeys=[]; rows[2].images=[];rows[3].name='Aktueller öffentlicher Name';
 const html=renderToStaticMarkup(createElement(AutumnShowcase,{listings:rows}));
 assert.equal((html.match(/data-autumn-profile=/g)||[]).length,2);
 assert.match(html,/Aktueller öffentlicher Name/);assert.doesNotMatch(html,/existing-1|existing-2/);
});

test('homepage reuses its public directory without another loader and keeps the existing season navigation',()=>{
 const page=readFileSync(new URL('../src/app/(energieheld)/page.tsx',import.meta.url),'utf8');
 assert.match(page,/<AutumnShowcase listings=\{directory.database\} \/>/);
 assert.match(page,/<TravelSeasons \/>/);
 assert.equal((page.match(/loadReiseportalDirectory\(\)/g)||[]).length,1);
 const componentSource=readFileSync(new URL('../src/components/portal/autumn-showcase.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(componentSource,/createPublicClient|createSignedUrl|fetch\(|useEffect|useState/);
 assert.ok(existsSync(new URL('../public/reiseportal/seasons/herbst-auszeit.webp',import.meta.url)));
});
