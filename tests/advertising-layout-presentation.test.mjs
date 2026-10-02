import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
registerHooks({
  resolve(s,c,next) {
    if(s==='react' && c.parentURL?.startsWith('data:')) return next(s,{...c,parentURL:import.meta.url});
    if(s==='next/link'||s==='next/image') return {url:`data:text/javascript,export default ${JSON.stringify(s==='next/link'?'a':'img')}`,shortCircuit:true};
    if(s.endsWith('/campaign-view')) return {url:'data:text/javascript,import{createElement}from"react";export function CampaignSlot({placement,ad}){return createElement("section",{"data-slot":placement,"data-campaign":ad?.id})}',shortCircuit:true};
    if(s.endsWith('/inline-banner-context')) return {url:'data:text/javascript,export function useInlineBanners(){return undefined}',shortCircuit:true};
    if(s.endsWith('/directory-edit-mode')) return {url:'data:text/javascript,export function DirectoryEditModeProvider({children}){return children}',shortCircuit:true};
    if(s.startsWith('@/')||s.startsWith('.')) {
      const base=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);
      for(const ext of ['.ts','.tsx']) if(existsSync(new URL(base.href+ext))) return next(base.href+ext,c);
    }
    return next(s,c);
  },
  load(url,c,next){if(/\.tsx?$/.test(url)) return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,c);}
});
const {AdvertisingLayout}=await import('../src/components/portal/trades.tsx');
const ads=[{id:'premium',placement:'top_banner',imageUrl:'/premium.jpg'},{id:'normal',placement:'sidebar_top',imageUrl:'/normal.jpg'}];
const render=(props={})=>renderToStaticMarkup(createElement(AdvertisingLayout,{ads,...props},createElement('form',{'aria-label':'Reisefinder'})));
test('A–Z places actual Premium inside the existing rail, before fixed A–L, never above search',()=>{
  const html=render({premiumInSidebar:true});
  assert.ok(html.indexOf('aria-label="Reisefinder"')<html.indexOf('data-slot="top_banner"'));
  assert.ok(html.indexOf('<aside')<html.indexOf('data-slot="top_banner"'));
  assert.ok(html.indexOf('data-slot="top_banner"')<html.indexOf('data-slot="sidebar_top"'));
  assert.equal((html.match(/data-campaign="premium"/g)||[]).length,1);
  assert.match(html,/data-campaign="normal"/);
  assert.deepEqual(ads.map(ad=>ad.placement),['top_banner','sidebar_top']);
});
test('missing or suppressed Premium stays absent publicly; admin can still manage that slot',()=>{
  for(const top of [undefined,{...ads[0],suppressed:true}]){
    const pageAds=top?[top,ads[1]]:[ads[1]];
    assert.doesNotMatch(render({premiumInSidebar:true,ads:pageAds}),/data-slot="top_banner"/);
    assert.match(render({premiumInSidebar:true,ads:pageAds,showEmptySlots:true}),/data-slot="top_banner"/);
  }
});
test('other advertising pages keep their previous above-content Premium layout',()=>{
  const html=render();assert.ok(html.indexOf('data-slot="top_banner"')<html.indexOf('aria-label="Reisefinder"'));
  assert.ok(html.indexOf('data-slot="top_banner"')<html.indexOf('<aside'));
});
