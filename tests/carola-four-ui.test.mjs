import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import * as jsx from 'react/jsx-runtime';
import './helpers/load-ts.mjs';
const {directoryBannerPool}=await import('../src/lib/directory-banner-layout.ts');
const {offerRequestStatuses}=await import('../src/lib/offer-requests.ts');
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(p,stubs){const loaded={exports:{}};vm.runInNewContext(transpileModule(source(p),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022,jsx:JsxEmit.ReactJSX}}).outputText,{module:loaded,exports:loaded.exports,require:n=>{if(n in stubs)return stubs[n];throw Error(n);},console});return loaded.exports;}
const all=n=>Array.isArray(n)?n.flatMap(all):n&&typeof n==='object'?[n,...all(n.props?.children)]:[];
test('request status remains controlled after React resets successful form; failure preserves selection and reports error',async()=>{
 let state={},action,error=false,saves=0,cursor=0;const hooks=[];
 const react={useState:init=>{const i=cursor++;if(!(i in hooks))hooks[i]=init;return[hooks[i],value=>hooks[i]=value]},useActionState:fn=>{action=async form=>{state=await fn(state,form)};return[state,action,false]}};
 const {OfferRequestDetail}=load('src/components/advertising/offer-request-form.tsx',{'react':react,'react/jsx-runtime':jsx,'next/image':'img','next/navigation':{useRouter:()=>({refresh(){}})},'@/lib/offer-request-workspace':{offerWorkspaceFields:{}},'@/app/(energieheld)/angebot-anfragen/actions':{updateOfferRequest:async(_state,form)=>{saves++;return error?{error:'Der Status konnte nicht gespeichert werden.'}:{success:'Status gespeichert.',requestStatus:form.get('request_status')}}},'@/lib/offer-requests':{offerRequestStatuses},'@/lib/ad-values':{adPlacements:{}},'@/lib/ad-target-areas':{portalAdAreaLabel:()=>''},'@/components/auth/auth.module.css':{default:{}}});
 const campaign={id:'qa',created_at:'2026-10-12T00:00:00Z',request_status:'new'};
 const render=()=>{cursor=0;return all(OfferRequestDetail({campaign}))};
 render().find(n=>n.type==='select').props.onChange({target:{value:'done'}});
 render();const f=new FormData();f.set('request_status','done');await action(f);
 let prevented=false;render().find(n=>n.type==='form').props.onReset({preventDefault(){prevented=true}});assert.equal(prevented,true);
 const saved=render().find(n=>n.type==='select');assert.equal(saved.props.value,'done');assert.equal(saved.props.defaultValue,undefined);assert.equal(saves,1);
 error=true;saved.props.onChange({target:{value:'new'}});render();f.set('request_status','new');await action(f);const failed=render();assert.equal(failed.find(n=>n.type==='select').props.value,'new');assert.match(failed.find(n=>n.props?.role==='alert').props.children,/nicht gespeichert/);
});
test('directory only uses delivered valid unique creatives and never creates a repetition sequence',()=>{
 const ad=id=>({id,placement:'sidebar_top',target_url:'https://hotel.test/'+id,imageUrl:'/'+id+'.png'});
 const pool=directoryBannerPool([ad('a'),ad('b'),ad('a'),{...ad('hidden'),suppressed:true},{id:'empty'},{...ad('bad'),target_url:'javascript:alert(1)'}]);assert.deepEqual(pool.map(a=>a.id),['a','b']);
 const directory=source('src/components/portal/travel-directory.tsx');assert.match(directory,/sidebarContent=/);assert.doesNotMatch(directory,/DirectoryBannerContinuation|directoryBannerSequence/);assert.match(directory,/directory-mobile-banner/);
});
