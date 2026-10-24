import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit, ScriptTarget } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const reactUrl = import.meta.resolve('react');
registerHooks({
  resolve(s,c,n){
    if (s === 'react') return {url:reactUrl,shortCircuit:true};
    const mocks={
      'server-only':'export {}',
      './inline-advertising-loader':'export async function loadInlineBannerOptions(path){globalThis.borrowedCalls.push(path);return globalThis.borrowedSources[path]}',
      './inline-banner-editor':'import {createElement} from "react";import {InlineBannerContext} from "'+new URL('../src/components/advertising/inline-banner-context.tsx',import.meta.url).href+'";export function InlineBannerProvider({options,children}){return createElement(InlineBannerContext.Provider,{value:{overrides:{},open(){},label:options.label}},children)}',
      './campaign-view':'import {createElement,useContext} from "react";import {InlineBannerContext} from "'+new URL('../src/components/advertising/inline-banner-context.tsx',import.meta.url).href+'";export function CampaignSlot(p){const c=useContext(InlineBannerContext);const ad=!p.searchResult&&c?.overrides[p.placement]||p.ad;return createElement("div",{"data-context":c?.label,"data-id":ad?.id},ad?.headline)}',
    };
    if(mocks[s])return{url:'data:text/javascript,'+encodeURIComponent(mocks[s]),shortCircuit:true};
    if(s.startsWith('@/')||s.startsWith('.')){const b=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);for(const e of ['.ts','.tsx'])if(existsSync(new URL(b.href+e)))return n(b.href+e,c)}return n(s,c);
  },
  load(u,c,n){return /\.tsx?$/.test(u)?{format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(u),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText}:n(u,c)},
});
const {loadBorrowedBannerEditing}=await import('../src/lib/borrowed-banner-editing.ts');
const {ContextualCampaignSlot}=await import('../src/components/advertising/contextual-campaign-slot.tsx');
const {InlineBannerContext}=await import('../src/components/advertising/inline-banner-context.tsx');
const local={label:'current page',banners:[],availability:{}};
const ad=id=>({id,placement:'top_banner',headline:id,image_path:id+'.jpg'});
const source='/mottoreisen/wellnessangebote';
function reset(){globalThis.borrowedCalls=[];globalThis.borrowedSources={};}
test('public rendering never loads admin inventory or source editors',async()=>{
  reset();assert.deepEqual(await loadBorrowedBannerEditing([ad('extra')],[{ad:ad('extra'),source_path:source}]),{});assert.deepEqual(globalThis.borrowedCalls,[]);
});
test('source-specific actions are reused once per source, local actions retained, unmatched identities fail closed',async()=>{
  reset();const options={...local,label:'source',banners:[{id:'one',placement:'top_banner'},{id:'two',placement:'sidebar_top'}]};globalThis.borrowedSources[source]=options;
  const result=await loadBorrowedBannerEditing([ad('one'),ad('two'),ad('wrong')],[{ad:ad('one'),source_path:source},{ad:ad('two'),source_path:source},{ad:{...ad('wrong'),image_path:'different.jpg'},source_path:source}],local);
  assert.equal(result.one,options);assert.equal(result.two,options);assert.equal(result.wrong,undefined);assert.deepEqual(globalThis.borrowedCalls,[source]);
  const own={...local,banners:[{id:'one'}]};assert.equal((await loadBorrowedBannerEditing([ad('one')],[],own)).one,own);
});
test('invalid source pages, unverified campaign membership and source errors never expose an editor',async()=>{
  reset();for(const path of ['https://other.test/','/admin/werbung/id','/mottoreisen/../admin'])assert.deepEqual(await loadBorrowedBannerEditing([ad('one')],[{ad:ad('one'),source_path:path}],local),{});
  assert.deepEqual(globalThis.borrowedCalls,[]);globalThis.borrowedSources[source]={...local,banners:[{id:'other'}]};assert.deepEqual(await loadBorrowedBannerEditing([ad('one')],[{ad:ad('one'),source_path:source}],local),{});
  globalThis.borrowedSources[source]={...local,error:'unavailable',banners:[{id:'one'}]};assert.deepEqual(await loadBorrowedBannerEditing([ad('one')],[{ad:ad('one'),source_path:source}],local),{});
});
test('borrowed premium preview cannot inherit another top-banner override',()=>{
  const options={...local,label:'original source',banners:[{id:'footer',placement:'top_banner'}]};const parent={label:'home',overrides:{top_banner:ad('main')}};
  const html=renderToStaticMarkup(createElement(InlineBannerContext.Provider,{value:parent},createElement(ContextualCampaignSlot,{placement:'top_banner',ad:ad('footer'),searchResult:true,editorOptions:{footer:options}})));
  assert.match(html,/data-context="original source"/);assert.match(html,/data-id="footer"/);assert.doesNotMatch(html,/data-id="main"/);
});
