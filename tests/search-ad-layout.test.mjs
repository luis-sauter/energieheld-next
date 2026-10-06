import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/load-ts.mjs';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){
 if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+'.ts',import.meta.url).href,context);
 return next(specifier,context);
}});
const { groupSearchAdvertisements, searchAdFormat, searchCreativeKey } = await import('../src/lib/search-ad-layout.ts');
const { selectSearchBannerEditor } = await import('../src/lib/search-banner-editor.ts');
const { travelSearchAdvertisers } = await import('../src/lib/travel-search-banners.ts');
const { readTravelFilterValues } = await import('../src/lib/reiseportal-filter-options.ts');
const banner=(id,width,height)=>({banner_key:id,advertiser_key:id,profile_id:null,postal_code:'',city:'',term_keys:[],source_path:'/unterkuenfte-a-z',ad:{id,placement:'sidebar_top',image_width:width,image_height:height,imageUrl:'/image.png',headline:id,target_url:'https://example.org/',image_path:null}});

test('true geometry splits standard/panoramic from square/portrait/unknown creatives',()=>{
 const rows=[banner('square',350,350),banner('standard',350,120),banner('portrait',200,600),banner('panorama',1500,120),banner('unknown')];
 const groups=groupSearchAdvertisements(rows);
 assert.deepEqual(groups.wide.map(b=>b.banner_key),['standard','panorama']);assert.deepEqual(groups.other.map(b=>b.banner_key),['square','portrait','unknown']);
 assert.equal(searchAdFormat({width:1500,height:120}).panoramic,true);
 for(const value of [{width:0,height:120},{width:350,height:0},{width:Infinity,height:1},{width:-1,height:5}])assert.equal(searchAdFormat(value).wide,false);
 assert.deepEqual(rows.map(b=>b.banner_key),['square','standard','portrait','panorama','unknown']);
});
test('natural dimensions classify unknown uploads without booking or size guesses',()=>{
 const row=banner('uploaded');row.ad.placement='top_banner';row.ad.banner_size='small';
 assert.equal(groupSearchAdvertisements([row]).other.length,1);
 const measured={[searchCreativeKey(row)]:{width:700,height:240}};assert.equal(groupSearchAdvertisements([row],measured).wide.length,1);
 row.ad.image_path='campaigns/new/creative/replacement.png';assert.equal(groupSearchAdvertisements([row],measured).other.length,1);
});
test('grouping preserves dedupe and best creative across formats',()=>{
 const square=banner('square',350,350),wide=banner('wide',350,120);square.advertiser_key=wide.advertiser_key='same';square.primary_creative=true;wide.term_keys=['theme:wellnessangebote'];
 const empty=readTravelFilterValues({}),normal=groupSearchAdvertisements(travelSearchAdvertisers([wide,square],empty));assert.equal(normal.wide.length,0);assert.equal(normal.other.length,1);
 const filtered=groupSearchAdvertisements(travelSearchAdvertisers([wide,square],{...empty,theme:'wellnessangebote'}));assert.equal(filtered.wide.length,1);assert.equal(filtered.other.length,0);
});
const options={banners:[{id:'legacy-a',placement:'sidebar_bottom',source:'legacy',target_url:'https://example.org/'}],label:'Natur pur',availability:{}};
test('editor selects exact live source page, identity and visible placement',async()=>{
 let called='';const result=await selectSearchBannerEditor({path:'/mottoreisen/natur-pur',id:'legacy-a',placement:'sidebar_bottom'},async path=>{called=path;return options;});
 assert.equal(called,'/mottoreisen/natur-pur');assert.equal(result.banner.id,'legacy-a');assert.equal(result.options,options);
});
test('editor rejects denied, missing and stale sources without guessing slots',async()=>{
 for(const request of [{path:'/admin/werbung',id:'legacy-a',placement:'sidebar_bottom'},{path:'/mottoreisen/natur-pur',id:'legacy-a',placement:'wrong'}]){
  let called=false;assert.ok((await selectSearchBannerEditor(request,async()=>{called=true;return options;})).error);assert.equal(called,false);
 }
 const request={path:'/mottoreisen/natur-pur',id:'legacy-a',placement:'sidebar_bottom'};
 assert.ok((await selectSearchBannerEditor(request,async()=>undefined)).error);
 assert.ok((await selectSearchBannerEditor(request,async()=>({...options,error:'Denied'}))).error);
 assert.ok((await selectSearchBannerEditor({...request,placement:'sidebar_top'},async()=>options)).error);
 assert.ok((await selectSearchBannerEditor({...request,id:'foreign-campaign'},async()=>options)).error);
});
