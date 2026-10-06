import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit} from 'typescript';
import './helpers/load-ts.mjs';
let intent=null;const calls=[];
registerHooks({resolve(s,c,next){
 if(c.parentURL?.endsWith('campaign-lifecycle.tsx')){
  if(s==='react')return{shortCircuit:true,url:'data:text/javascript,export const useState=()=>[globalThis.intent,v=>globalThis.intent=v];export const useActionState=(fn)=>[{},form=>fn({},form),false];'};
  if(s.endsWith('/admin/werbung/actions'))return{shortCircuit:true,url:'data:text/javascript,export const lifecycleCampaign=async(_,f)=>{globalThis.calls.push(Object.fromEntries(f));return {success:"ok"};};'};
  if(s.endsWith('.css'))return{shortCircuit:true,url:'data:text/javascript,export default {actions:"actions"};'};
 }return next(s,c);
},load(url,c,next){if(url.endsWith('.tsx'))return{shortCircuit:true,format:'module',source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,c);}});
const {CampaignLifecycle}=await import('../src/components/advertising/campaign-lifecycle.tsx');
function all(node,p){return !node||typeof node!=='object'?[]:[...(p(node)?[node]:[]),...Array.from([node.props?.children]).flat(Infinity).flatMap(n=>all(n,p))];}
test('one archive submit supplies internal confirmation, without visible confirmation; delete still requires it',async()=>{
 globalThis.intent=intent;globalThis.calls=calls;
 let tree=CampaignLifecycle({id:'original',archived:false});
 const archive=all(tree,n=>n.type==='button'&&n.props.value==='archive')[0];
 assert.equal(archive.props.type,'submit');assert.equal(all(tree,n=>n.type==='input'&&n.props.type==='checkbox').length,0);
 const form=new FormData();form.set('action',archive.props.value);form.set('campaign_id','original');await tree.props.action(form);
 assert.deepEqual(calls,[{action:'archive',campaign_id:'original',confirmed:'yes'}]);
 tree=CampaignLifecycle({id:'original',archived:true});all(tree,n=>n.type==='button'&&n.props.children==='Dauerhaft löschen')[0].props.onClick();
 tree=CampaignLifecycle({id:'original',archived:true});assert.equal(all(tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.required,true);
});
