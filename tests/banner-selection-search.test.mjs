import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function compile(path,imports){const loaded={exports:{}};vm.runInNewContext(transpileModule(read(path),{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText,{module:loaded,exports:loaded.exports,require:name=>imports[name],Date,Map});return loaded.exports;}
const cache=compile('src/lib/media-library-company-cache.ts',{});
let query='';const picker=function ExistingCompanyPicker(){};
const components=compile('src/components/advertising/banner-selection-search.tsx',{
 'react':{...React,useMemo:fn=>fn(),useState:()=>[query,next=>query=next]},'react/jsx-runtime':jsx,
 '../admin/media-library-company-picker':{MediaLibraryCompanyPicker:picker},'@/lib/media-library-company-cache':cache,
});

test('existing picker searches bounded advertiser results by partial names and folded umlauts without losing identities',async()=>{
 const rows=Array.from({length:45},(_,i)=>({id:'profile:'+i,display_name:'Hotel '+i}));rows.push({id:'customer:1',display_name:'Haus Salzburg Bad Füssing'},{id:'profile:m',display_name:'Hôtel München'});
 const search=cache.localCompanySearchCache(rows);
 assert.equal((await search.get('',1)).items.length,20);assert.equal((await search.get('',1)).more,true);
 assert.equal((await search.get('',3)).items.length,7);assert.equal((await search.get('',3)).more,false);
 assert.equal((await search.get('fussing',1)).items[0].id,'customer:1');assert.equal((await search.get('MÜN',1)).items[0].id,'profile:m');
 assert.equal((await search.get('missing',1)).items.length,0);
 assert.deepEqual(JSON.parse(JSON.stringify(rows.at(-1))),{id:'profile:m',display_name:'Hôtel München'});
});

test('banner adapter reuses the same picker, preselects saved identity and disables company creation',async()=>{
 let changed;const node=components.BannerAdvertiserPicker({value:'profile:a',name:'Gespeicherte Firma',advertisers:[{key:'profile:a',name:'Gespeicherte Firma',profile_id:'a'}],onChange:key=>changed=key});
 assert.equal(node.type,picker);assert.equal(node.props.value,'profile:a');assert.equal(node.props.name,'Gespeicherte Firma');assert.equal(node.props.allowCreate,false);
 assert.equal(changed,undefined);const result=await node.props.searchCache.get('firma',1);assert.equal(result.items[0].id,'profile:a');
 node.props.onChange({id:'profile:a',display_name:'Gespeicherte Firma'});assert.equal(changed,'profile:a');
});

test('category filtering retains checked form controls and callbacks, clearing the query restores every choice',()=>{
 const change=()=>{};const children=['Wellness','Radwandern'].map((name,i)=>React.createElement('label',{key:name,'data-search-label':name},React.createElement('input',{name:'banner_terms',value:'theme:'+i,type:'checkbox',checked:i===0,onChange:change}),name));
 const props={children};query='rad';let tree=components.BannerCategoryFilter(props);let labels=tree.props.children[1];let prevented=false;tree.props.children[0].props.children[1].props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});assert.equal(prevented,true);
 assert.equal(labels[0].props.hidden,true);assert.equal(labels[0].props.children[0].props.checked,true);assert.equal(labels[0].props.children[0].props.name,'banner_terms');assert.equal(labels[0].props.children[0].props.onChange,change);assert.equal(labels[1].props.hidden,false);
 tree.props.children[0].props.children[1].props.onChange({target:{value:''}});tree=components.BannerCategoryFilter(props);labels=tree.props.children[1];assert.equal(labels.some(row=>row.props.hidden),false);
 assert.equal(children[0].props.hidden,undefined);
});
