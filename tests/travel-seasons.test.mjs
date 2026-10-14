import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
  if(specifier.endsWith('.css'))return {url:'data:text/javascript,export default '+encodeURIComponent(JSON.stringify({section:'section',grid:'grid',card:'card',image:'image',copy:'copy',badge:'badge',link:'link'})),shortCircuit:true};
  if(specifier==='next/image')return {url:'data:text/javascript,'+encodeURIComponent('import {createElement} from "react";export default function Image({fill,priority,...props}){return createElement("img",props)}'),shortCircuit:true};
  if(specifier==='react' && context.parentURL?.startsWith('data:'))return next(specifier,{...context,parentURL:import.meta.url});
  if(specifier.startsWith('@/')||specifier.startsWith('.')){
   const base=specifier.startsWith('@/')?new URL('../src/'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);
   for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,context);
  }return next(specifier,context);
 },load(url,context,next){if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+readFileSync(new URL(url),'utf8')};if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,context);}
});
const {travelSeasons,currentTravelSeason,orderedTravelSeasons,validSeasonTeasers}=await import('../src/lib/travel-seasons.ts');
const {TravelSeasons}=await import('../src/components/portal/travel-seasons.tsx');
const {filterTravelDiscovery}=await import('../src/lib/reiseportal-search.ts');
const {readTravelFilterValues,activeTravelFilterLabels,availableTravelFilters}=await import('../src/lib/reiseportal-filter-options.ts');
const {travelSearchUrl,travelSearchReturnUrl}=await import('../src/lib/travel-search-intent.ts');
const {portalSearchFilters}=await import('../src/lib/portal-search.ts');
test('meteorological seasons use Berlin at all twelve month boundaries, year change and DST',()=>{
 for(let month=1;month<=12;month++){const expected=month>=3&&month<=5?0:month>=6&&month<=8?1:month>=9&&month<=11?2:3;assert.equal(currentTravelSeason(new Date(`2026-${String(month).padStart(2,'0')}-15T12:00:00Z`)).slug,travelSeasons[expected].slug)}
 for(const [date,slug] of [['2026-02-28T22:59:59Z','saison-winter'],['2026-02-28T23:00:00Z','saison-fruehling'],['2026-05-31T21:59:59Z','saison-fruehling'],['2026-05-31T22:00:00Z','saison-sommer'],['2026-08-31T22:00:00Z','saison-herbst'],['2026-11-30T23:00:00Z','saison-winter'],['2026-12-31T23:00:00Z','saison-winter'],['2026-03-29T01:00:00Z','saison-fruehling'],['2026-10-25T01:00:00Z','saison-herbst']])assert.equal(currentTravelSeason(new Date(date)).slug,slug);
});
test('four real seasonal links, current first once, fixed SSR output, existing images, no prefetch/carousel',()=>{
 const date=new Date('2026-10-13T12:00:00Z'),html=renderToStaticMarkup(createElement(TravelSeasons,{date}));
 assert.equal(orderedTravelSeasons(date)[0].label,'Herbst');assert.equal((html.match(/Aktuelle Jahreszeit/g)||[]).length,1);
 for(const season of travelSeasons){assert.match(html,new RegExp('href="/unterkuenfte-a-z\\?thema='+season.slug+'"'));assert.ok(existsSync(new URL('../public'+season.image,import.meta.url)))}
 assert.equal(html,renderToStaticMarkup(createElement(TravelSeasons,{date})));assert.doesNotMatch(html,/button|carousel|iframe/);
});
test('season results require exact assignments, support multiple seasons, and never guess from copy/slug',()=>{
 const row=(id,keys)=>({id,slug:id,travelTermKeys:keys,description:'Winter Ski Hotel Sommer Natur',location:{country:'Deutschland'}});
 const rows=[row('one',['theme:saison-winter','theme:saison-sommer']),row('winter-ski',[]),row('two',['theme:saison-sommer'])];
 assert.deepEqual(filterTravelDiscovery(rows,'','saison-winter').map(r=>r.id),['one']);
 assert.deepEqual(filterTravelDiscovery(rows,'','saison-sommer').map(r=>r.id),['one','two']);
 assert.deepEqual(filterTravelDiscovery(rows,'','saison-fruehling'),[]);
 assert.deepEqual(filterTravelDiscovery(rows,'schweiz','saison-winter'),[]);
});
test('existing search RPC receives exact theme; q, sort, return URL and season label survive without changing rank engine',()=>{
 const values=readTravelFilterValues({thema:'saison-herbst',q:'Pool',sort:'name',ort:'Lana'});
 assert.equal(portalSearchFilters(values).theme,'saison-herbst');
 assert.equal(travelSearchUrl(values,'directory'),'/suche?thema=saison-herbst&q=Pool&sort=name&von=directory');
 assert.equal(travelSearchReturnUrl(values,'directory'),'/unterkuenfte-a-z?thema=saison-herbst&q=Pool&sort=name');
 assert.ok(activeTravelFilterLabels(values,availableTravelFilters([],[])).includes('Jahreszeit: Herbst'));
 assert.equal(validSeasonTeasers({'theme:saison-herbst':'Ruhige Zeit im Spa.'}),true);
 for(const invalid of [null,[],{'theme:wellnessangebote':'wrong'},{'theme:saison-winter':'x'.repeat(241)}])assert.equal(validSeasonTeasers(invalid),false);
});
