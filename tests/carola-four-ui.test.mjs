import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import * as jsx from 'react/jsx-runtime';
import './helpers/load-ts.mjs';
import {directoryBannerPool,directoryBannerSequence} from '../src/lib/directory-banner-layout.ts';
const {offerRequestStatuses}=await import('../src/lib/offer-requests.ts');
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(p,stubs){const loaded={exports:{}};vm.runInNewContext(transpileModule(source(p),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022,jsx:JsxEmit.ReactJSX}}).outputText,{module:loaded,exports:loaded.exports,require:n=>{if(n in stubs)return stubs[n];throw Error(n);},console});return loaded.exports;}
const all=n=>Array.isArray(n)?n.flatMap(all):n&&typeof n==='object'?[n,...all(n.props?.children)]:[];
test('request status remains controlled after React resets successful form; failure preserves selection and reports error',async()=>{
 let status='new',state={},action,error=false,saves=0;
 const react={useState:init=>[status??init,value=>status=value],useActionState:fn=>{action=async form=>{state=await fn(state,form)};return[state,action,false]}};
 const {OfferRequestDetail}=load('src/components/advertising/offer-request-form.tsx',{'react':react,'react/jsx-runtime':jsx,'next/image':'img','@/app/(energieheld)/angebot-anfragen/actions':{updateOfferRequest:async(_state,form)=>{saves++;return error?{error:'Der Status konnte nicht gespeichert werden.'}:{success:'Status gespeichert.',requestStatus:form.get('request_status')}}},'@/lib/offer-requests':{offerRequestStatuses},'@/lib/ad-values':{adPlacements:{}},'@/lib/ad-target-areas':{portalAdAreaLabel:()=>''},'@/components/auth/auth.module.css':{default:{}}});
 const campaign={id:'qa',created_at:'2026-10-12T00:00:00Z',request_status:'new'};
 const render=()=>all(OfferRequestDetail({campaign}));
 render().find(n=>n.type==='select').props.onChange({target:{value:'done'}});
 render();const f=new FormData();f.set('request_status','done');await action(f);
 const saved=render().find(n=>n.type==='select');assert.equal(saved.props.value,'done');assert.equal(saved.props.defaultValue,undefined);assert.equal(saves,1);
 error=true;saved.props.onChange({target:{value:'new'}});render();f.set('request_status','new');await action(f);const failed=render();assert.equal(failed.find(n=>n.type==='select').props.value,'new');assert.match(failed.find(n=>n.props?.role==='alert').props.children,/nicht gespeichert/);
});
test('repeat pool only reuses delivered visible creatives, deduplicates IDs, and never has identical neighbours',()=>{
 const ad=id=>({id,placement:'sidebar_top',imageUrl:'/'+id+'.png'});
 const pool=directoryBannerPool([ad('a'),ad('b'),ad('a'),{...ad('hidden'),suppressed:true},{id:'empty'}]);assert.deepEqual(pool.map(a=>a.id),['a','b']);
 const sequence=directoryBannerSequence(pool,100,'a');assert.equal(sequence[0].id,'b');assert.equal(sequence.length,100);assert.ok(sequence.every((ad,i)=>!i||ad.id!==sequence[i-1].id));
 assert.deepEqual(directoryBannerSequence([],10),[]);assert.deepEqual(directoryBannerSequence([ad('a')],20,'a'),[]);assert.equal(directoryBannerSequence([ad('a')],20).length,1);
});
test('sidebar continuation measures existing content and never reads/writes tracking or campaign data',()=>{
 const component=source('src/components/advertising/directory-banner-continuation.tsx');assert.match(component,/ResizeObserver/);assert.doesNotMatch(component,/\.rpc\(|fetch\(|createClient|\.from\(["']/);
 const directory=source('src/components/portal/travel-directory.tsx');assert.match(directory,/sidebarContinuation=/);assert.doesNotMatch(directory,/!error && advertisements/);assert.match(directory,/directory-mobile-banner/);
});
