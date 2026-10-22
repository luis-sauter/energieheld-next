import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transpileModule,ModuleKind,ScriptTarget} from 'typescript';

test('public A–Z/search batches load saved card selections and crops once, for visible IDs only',async()=>{
 const chosen={src:'/chosen.jpg',alt:'Selected image'},crop={focus_x:55,focus_y:50,zoom:1.07};
 const rows=[{id:'one',slug:'one',location:{country:'Deutschland',region:'Bayern'},images:[],description:'Original'}];
 let cardCalls=0;const requested=[];
 const stubs={
  'server-only':{},'./profile-card-images':{withSavedCardImages:async listings=>{cardCalls++;assert.deepEqual(Array.from(listings,r=>r.id),['one']);return listings.map(row=>({...row,travelImage:chosen,cardImageAssetId:'asset',cardImageCrop:crop}));}},
  './public-profile-imports':{},'@/data/reiseportal-preview':{reiseportalPreview:[]},'@/data/reiseportal-import-media':{importedJoomlaMedia:{}},
  '../data/reiseportal-legacy-directory-media.json':{},'../data/reiseportal-legacy-provider-media.json':{},'../data/reiseportal-travel-provider-images.json':{},
  './company-presentation':{},'./company-directory-order':{},'./public-companies':{loadPublicCompanyDirectory:async options=>{requested.push(options);return {data:{listings:rows},error:null};}},
  './reiseportal-demo':{},'./public-travel-taxonomy':{},'./reiseportal-search':{},'./provider-card-media':{providerTravelImage:()=>null},
  './supabase/public':{createPublicClient:()=>({from(){return {select(){return this;},order(){return this;},range(){return this;},async in(){return {data:[{profile_id:'one',package:'premium'}],error:null};}};}})},
 };
 const loadedModule={exports:{}};
 vm.runInNewContext(transpileModule(readFileSync(new URL('../src/lib/reiseportal-directory.ts',import.meta.url),'utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:loadedModule,exports:loadedModule.exports,require:key=>{assert.ok(key in stubs,key);return stubs[key];}});
 const loaded=await loadedModule.exports.loadReiseportalSearchListings(['one','one'],[]);
 assert.equal(cardCalls,1);assert.deepEqual(Array.from(requested[0].profileIds),['one']);
 assert.equal(loaded[0].travelImage,chosen);assert.equal(loaded[0].cardImageCrop,crop);assert.equal(loaded[0].cardImageAssetId,'asset');
 assert.equal(rows[0].cardImageAssetId,undefined);
 await loadedModule.exports.loadReiseportalSearchListings([],[]);assert.equal(cardCalls,1);
});

