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
const render=(ads,placements)=>renderToStaticMarkup(createElement(loaded.exports.HomeBannerGroup,{ads,placements,label:'Existing banners'}));
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
