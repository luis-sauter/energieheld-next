import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
 resolve(specifier, context, next) {
  if (specifier.endsWith('.css')) return { url: 'data:text/javascript,export function useLinkStatus(){return {pending:false}};export default ' + encodeURIComponent(JSON.stringify({ section:'section',card:'card',header:'header',editorial:'editorial',photo:'photo',copy:'copy' })), shortCircuit:true };
  if (specifier === 'next/link') return { url:'data:text/javascript,' + encodeURIComponent('import {createElement} from "react";export function useLinkStatus(){return {pending:false}};export default function Link({prefetch,...p}){return createElement("a",p)}'), shortCircuit:true };
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
const { SPECIAL_TOPIC_TERM } = await import('../src/lib/travel-editorial.ts');
const { AUTUMN_TERM, AUTUMN_HREF, autumnSelections, winterSelections, selectAutumnStays } = await import('../src/lib/autumn-showcase.ts');
const { AutumnShowcase } = await import('../src/components/portal/autumn-showcase.tsx');
const fixtures = () => autumnSelections.map((entry,index) => ({
 id:entry.profileId,slug:'existing-'+index,name:'Echter Anbieter '+index,isDemo:false,isPreview:false,
 travelTermKeys:[SPECIAL_TOPIC_TERM,'theme:wellnessangebote'],seasonTeasers:{[AUTUMN_TERM]:'Gespeicherter saisonaler Kurztext.'},
 location:{city:'Ort',country:'Österreich'},logo:{src:'/logo.png',alt:'Logo'},
 images:[{id:'unselected',src:'/other.jpg',alt:'Anderes Bild'},{id:entry.imageId,src:'/actual-'+index+'.jpg',alt:'Originalfoto'}]
 }));

test('special topic uses its own assignment, keeps curated images and never mutates media',()=>{
 const listings=fixtures(),before=JSON.stringify(listings);
 assert.equal(selectAutumnStays(listings).length,4);
 assert.equal(selectAutumnStays(listings)[0].image.src,'/actual-0.jpg');
 assert.equal(JSON.stringify(listings),before);
 for(const change of [row=>({...row,travelTermKeys:[]}),row=>({...row,travelTermKeys:['theme:natur-pur','theme:saison-sommer']}),row=>({...row,isDemo:true}),row=>({...row,isPreview:true}),row=>({...row,images:[]}),row=>({...row,images:[row.images[1]],logo:row.images[1]})]) {
  assert.equal(selectAutumnStays([change(listings[0])]).length,0);
 }
 assert.equal(selectAutumnStays([{...listings[0],id:'new-editorially-selected-profile'}]).length,1);
 assert.equal(selectAutumnStays([{...listings[0],travelTermKeys:[AUTUMN_TERM]}]).length,0);
 assert.equal(selectAutumnStays([...listings,...listings]).length,4);
 assert.equal(selectAutumnStays(Array.from({length:8},(_,i)=>({...listings[0],id:'selected-'+i}))).length,8);
 assert.equal(selectAutumnStays([{...listings[0],images:[listings[0].images[0]]}])[0].image.src,'/other.jpg');
 assert.equal(selectAutumnStays([]).length,0);
 const fifth={...listings[0],id:'sonnenhof',slug:'pension-sonnenhof',name:'Pension Sonnenhof'};
 assert.equal(selectAutumnStays([...listings,fifth]).at(-1).listing.id,'sonnenhof');
 const html=renderToStaticMarkup(createElement(AutumnShowcase,{listings:[...listings,fifth]}));
 assert.equal((html.match(/data-autumn-profile=/g)||[]).length,5);
 assert.match(html,/href="\/unterkuenfte\/pension-sonnenhof"/);
 assert.match(html,/data-page-size="4"/);
 assert.equal((html.match(/data-carousel-page=/g)||[]).length,2);
 assert.match(html,/Sonderthemen-Unterkünfte: weiter/);
});

test('seasonal layout keeps genuine linked cards, includes winter entry and omits public image-generation labels',()=>{
 const rows=fixtures(),html=renderToStaticMarkup(createElement(AutumnShowcase,{listings:rows}));
 assert.equal((html.match(/data-autumn-profile=/g)||[]).length,4);
 assert.equal((html.match(/src="\/reiseportal\/seasons\/herbst-auszeit.webp"/g)||[]).length,1);
 assert.doesNotMatch(html,/KI-generiertes Symbolbild/);
 assert.match(html,/Jahreszeiten mit Charakter/);
 assert.match(html,/href="\/mottoreisen\/skifahren"/);
 assert.match(html,/Alle Unterkünfte entdecken/);
 assert.doesNotMatch(html,/href="[^\"]*saison-/);
 assert.ok(html.includes('href="'+AUTUMN_HREF+'"'));
 for(const row of rows)assert.ok(html.includes('href="/unterkuenfte/'+row.slug+'"'));
 assert.doesNotMatch(html,/Gespeicherter saisonaler Kurztext/);
 assert.doesNotMatch(html,/Panorama Lodge Aurelia|Chalet Kupferlaub|Herbstresidenz Mirabell|Seegut Waldruh|iframe/);
 assert.equal(renderToStaticMarkup(createElement(AutumnShowcase,{listings:[]})),'');
});

test('season badges require an actual assignment and never create nested profile links',()=>{
 const rows=fixtures();rows[0].travelTermKeys.push('theme:skifahren','theme:saison-winter');
 const html=renderToStaticMarkup(createElement(AutumnShowcase,{listings:rows}));
 assert.equal((html.match(/<li>Winter<\/li>/g)||[]).length,1);
 assert.equal((html.match(/<li>Skiurlaub<\/li>/g)||[]).length,1);
 assert.doesNotMatch(html,/<a[^>]*class="cardLink"(?:(?!<\/a>)[^])*?<a/);
});

test('additional ski hosts are mixed into the first page only with a saved editorial assignment',()=>{
 const base=fixtures();const ski=winterSelections.map(s=>({...base[0],id:s.profileId,slug:'ski-'+s.profileId,name:'Ski-Unterkunft',travelTermKeys:[SPECIAL_TOPIC_TERM,'theme:skifahren','theme:saison-winter'],images:[{id:s.imageId,src:'/operator-ski.jpg',alt:s.alt}]}));
 const selected=selectAutumnStays([...base,...ski]);
 assert.equal(selected.length,9);
 assert.equal(selected[1].listing.id,ski[0].id);assert.equal(selected[3].listing.id,ski[1].id);
 assert.equal(selectAutumnStays(ski.map(s=>({...s,travelTermKeys:['theme:skifahren']}))).length,0);
 const removed={...base[0],id:'49b2316e-dd69-4d68-9f10-b7fc86100cf8',name:'Pension Sonnenhof',travelTermKeys:['theme:saison-winter']};
 assert.equal(selectAutumnStays([...base,...ski,removed]).some(s=>s.listing.id===removed.id),false);
});

test('partial selection collapses absent providers without placeholders; content follows current records',()=>{
 const rows=fixtures(); rows[1].travelTermKeys=[]; rows[2].images=[];rows[3].name='Aktueller öffentlicher Name';
 const html=renderToStaticMarkup(createElement(AutumnShowcase,{listings:rows}));
 assert.equal((html.match(/data-autumn-profile=/g)||[]).length,2);
 assert.match(html,/Aktueller öffentlicher Name/);assert.doesNotMatch(html,/existing-1|existing-2/);
});

test('homepage reuses its public directory without another loader and excludes the retired four-card season section',()=>{
 const page=readFileSync(new URL('../src/app/(energieheld)/page.tsx',import.meta.url),'utf8');
 assert.match(page,/<AutumnShowcase listings=\{directory.database\} \/>/);
 assert.doesNotMatch(page,/<TravelSeasons|import \{ TravelSeasons \}/);
 assert.equal((page.match(/loadReiseportalDirectory\(\{ cardOnly: true \}\)/g)||[]).length,1);
 const componentSource=readFileSync(new URL('../src/components/portal/autumn-showcase.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(componentSource,/createPublicClient|createSignedUrl|fetch\(|useEffect|useState/);
 assert.ok(existsSync(new URL('../public/reiseportal/seasons/herbst-auszeit.webp',import.meta.url)));
});
