import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
let inline=null;
const slots=['sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12'];
const ad=(placement,id=placement)=>({placement,id,imageUrl:'/real.jpg',headline:id,target_url:'https://example.org/'+id});
const file=readFileSync(new URL('../src/components/advertising/home-banner-group.tsx',import.meta.url),'utf8');
const loaded={exports:{}};
function CampaignSlot({placement,ad:initial}){const row=inline&&Object.hasOwn(inline.overrides,placement)?inline.overrides[placement]:initial;return createElement('aside',{'data-placement':placement},row&&!row.suppressed?createElement('a',{href:row.target_url},row.headline):'Admin empty slot');}
vm.runInNewContext(transpileModule(file,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText,{module:loaded,exports:loaded.exports,require:name=>{
 if(name==='react/jsx-runtime')return jsx;
 if(name==='./inline-banner-context')return {useInlineBanners:()=>inline};
 if(name==='./campaign-view')return {CampaignSlot};
 if(name==='./advertising-rail')return {AdvertisingRail:({visibleSlots,ads})=>createElement('div',{},visibleSlots.filter(slot=>inline||ads.some(row=>row.placement===slot&&!row.suppressed)).map(slot=>createElement(CampaignSlot,{key:slot,placement:slot,ad:ads.find(row=>row.placement===slot)})))};
 if(name.endsWith('.module.css'))return {default:{partners:'partners'}};
 throw Error(name);
}});
const render=(ads,placements,adminOnly=false)=>renderToStaticMarkup(createElement(loaded.exports.HomeBannerGroup,{ads,placements,adminOnly,label:'Existing banners'}));
test('empty or suppressed public groups produce no container, placeholder or whitespace section',()=>{
 inline=null;assert.equal(render([],slots.slice(0,3)),'');assert.equal(render([{...ad(slots[0]),suppressed:true}],slots.slice(0,3)),'');assert.equal(render([],['top_banner']),'');
});
test('A–C, Premium, D–F and remaining G–L are disjoint and never rename campaign targets',()=>{
 inline=null;const ads=[ad('top_banner'),...slots.map(slot=>ad(slot))],before=JSON.stringify(ads);
 const html=[slots.slice(0,3),['top_banner'],slots.slice(3,6),slots.slice(6)].map(group=>render(ads,group)).join('');
 assert.deepEqual([...html.matchAll(/data-placement="([^"]+)"/g)].map(match=>match[1]),[...slots.slice(0,3),'top_banner',...slots.slice(3)]);
 assert.equal(JSON.stringify(ads),before);for(const row of ads)assert.equal((html.match(new RegExp('href="'+row.target_url+'"','g'))||[]).length,1);
});
test('admin can edit each empty requested slot and client removal never resurrects the initial campaign',()=>{
 inline={overrides:{}};let html=render([],slots.slice(0,3));assert.equal((html.match(/Admin empty slot/g)||[]).length,3);
 inline.overrides[slots[0]]=null;html=render([ad(slots[0])],slots.slice(0,3));assert.doesNotMatch(html,/href=/);
 inline=null;assert.equal(render([],slots.slice(0,3)),'');
});


test('homepage removes all G–L rendering for every role while keeping the two new editable groups',()=>{
 const home=readFileSync(new URL('../src/app/(energieheld)/page.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(home,/Weitere Banner verwalten|placements=\{\["sidebar_07"/);
 assert.equal((home.match(/<HomeBannerGroup/g)||[]).length,3);
 inline={overrides:{}};for(const group of [slots.slice(0,3),['top_banner'],slots.slice(3,6)])assert.match(render([],group),/Admin empty slot/);
 inline=null;
});

test('mixed public groups omit image-less and suppressed banners without empty fixed-slot cells',()=>{
 inline=null;const ads=[ad(slots[0]),{...ad(slots[1]),imageUrl:''},{...ad(slots[2]),suppressed:true}];
 const html=render(ads,slots.slice(0,3));assert.equal((html.match(/data-placement=/g)||[]).length,1);
 assert.doesNotMatch(html,/Admin empty slot|sidebar_middle|sidebar_bottom/);
});

test('homepage-only spacing and empty placeholder cleanup leave other pages and card geometry intact',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const css=read('src/app/(energieheld)/home.module.css');
 assert.match(css,/\.page \.partners \{ background: transparent; padding-block: 20px; margin-bottom: 0/);
 assert.match(css,/\.partners :global\(\[data-empty-banner\]\) \{ display: none/);
 assert.match(css,/max-width: 700px[\s\S]*?\.page \.partners \{ padding-block: 14px/);
 const view=read('src/components/advertising/campaign-view.tsx');assert.match(view,/className=\{styles.empty\} data-empty-banner/);
 const card=read('src/components/portal/accommodation-card.module.css');assert.match(card,/min-height: 16rem; aspect-ratio: 35 \/ 32/);
});
