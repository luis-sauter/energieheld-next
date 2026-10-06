import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='next/link'||specifier==='next/image')return {url:`data:text/javascript,export default ${JSON.stringify(specifier==='next/link'?'a':'img')}`,shortCircuit:true};
  if(specifier.endsWith('.module.css'))return {url:'data:text/javascript,export default new Proxy({}, {get:(_,key)=>key})',shortCircuit:true};
  if(specifier.startsWith('@/')||specifier.startsWith('.')){
   const base=specifier.startsWith('@/')?new URL('../src/'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);
   for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,context);
  }return next(specifier,context);
 },
 load(url,context,next){if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return next(url,context);}
});
const {matchTravelSearchBanners,travelSearchResults,interleaveTravelResults}=await import('../src/lib/travel-search-banners.ts');
const {publicBannerCreatives}=await import('../src/lib/portal-search-banners.ts');
const {readTravelFilterValues,availableTravelFilters}=await import('../src/lib/reiseportal-filter-options.ts');
const {TravelFinder}=await import('../src/components/portal/travel-finder.tsx');
const {CampaignSlot}=await import('../src/components/advertising/campaign-view.tsx');
const {InlineBannerContext}=await import('../src/components/advertising/inline-banner-context.tsx');
const empty=readTravelFilterValues({});
const banner=(key='campaign:a',extra={})=>({banner_key:key,profile_id:null,postal_code:'80331',city:'München',term_keys:['theme:wellnessangebote','audience:paar','accommodation:hotel','feature:sauna'],ad:{id:key,placement:'sidebar_top',headline:'Öffentlicher Banner',target_url:'https://example.org/',image_path:null,imageUrl:'/creative.png'},...extra});
const listing=(id)=>({id,slug:id,name:id,categoryIds:[],services:[],location:{city:'Berlin',postalCode:'10115',region:'',country:'DE'},travelTermKeys:[],directoryPackage:'basic'});
test('canonical identities dedupe pages/themes/slots and legacy but not distinct campaigns of one profile',()=>{
 const duplicates=['/','/unterkuenfte-a-z','/mottoreisen/natur-pur','/mottoreisen/wanderurlaub','/mottoreisen/wellnessangebote'].map(()=>banner());
 const result=matchTravelSearchBanners([...duplicates,banner('campaign:b',{profile_id:'same'}),banner('campaign:c',{profile_id:'same'}),banner('legacy:x'),banner('legacy:x')],empty);
 assert.equal(result.length,4);
});
for(const [dimension,value] of [['theme','wellnessangebote'],['audience','paar'],['accommodation','hotel'],['feature','sauna']])test(`${dimension} uses explicit Search term keys`,()=>{
 assert.equal(matchTravelSearchBanners([banner(),banner('campaign:empty',{term_keys:[]})],{...empty,[dimension]:value}).length,1);
 assert.equal(matchTravelSearchBanners([banner()],{...empty,[dimension]:'unknown'}).length,0);
});
test('AND, normalized city/postcode and no inferred destination or booking relation',()=>{
 assert.equal(matchTravelSearchBanners([banner()],{...empty,theme:'wellnessangebote',audience:'familie'}).length,0);
 for(const location of ['80331','münchen','MUNCHEN'])assert.equal(matchTravelSearchBanners([banner()],{...empty,location}).length,1);
 assert.equal(matchTravelSearchBanners([banner()],{...empty,destination:'deutschland'}).length,0);
 assert.equal(matchTravelSearchBanners([banner('x',{term_keys:[]})],{...empty,theme:'wellnessangebote'}).length,0);
});
test('missing/invalid creative and suppressed sources never count',()=>{
 for(const ad of [{...banner().ad,imageUrl:undefined},{...banner().ad,suppressed:true},{...banner().ad,target_url:'javascript:alert(1)'}])assert.equal(matchTravelSearchBanners([banner('x',{ad})],empty).length,0);
});
test('59 listings plus 14 unique banners = 73, count equals inline entries, Home and Directory agree',()=>{
 const listings=Array.from({length:59},(_,i)=>listing(String(i))),banners=Array.from({length:14},(_,i)=>banner(`campaign:${i}`));
 const result=travelSearchResults(listings,[...banners,...banners],empty);assert.equal(result.count,73);
 assert.equal(interleaveTravelResults(result.listings,result.banners).length,73);
 for(const mode of ['home','directory']){
  const html=renderToStaticMarkup(createElement(TravelFinder,{mode,listings,banners:[...banners,...banners],options:availableTravelFilters(listings,[]),values:empty,onChange(){}}));
  assert.match(html,/73 Unterkünfte anzeigen/);
 }
});
test('two real profile associations follow listing; unmatched relation stays standalone, deterministic sorting and no guessing',()=>{
 const a=listing('a'),b=listing('b');const banners=[banner('x',{profile_id:'a'}),banner('y',{profile_id:'a'}),banner('z',{profile_id:'missing'}),banner('zz')];
 const rows=interleaveTravelResults([a,b],banners);
 assert.deepEqual(rows.slice(0,3).map(row=>row.kind==='listing'?row.listing.id:row.banner.banner_key),['a','x','y']);
 assert.deepEqual(interleaveTravelResults([a,b],banners),rows);
 assert.equal(rows.length,6);assert.deepEqual(rows.filter(r=>r.kind==='listing').map(r=>r.listing.id),['a','b']);
 const reversed=interleaveTravelResults([b,a],banners);assert.equal(reversed[reversed.findIndex(r=>r.kind==='listing'&&r.listing.id==='a')+1].banner.banner_key,'x');
});
test('banner-only results count/render; truly empty remains empty',()=>{
 const result=travelSearchResults([], [banner(),banner('b'),banner('c')],empty);assert.equal(result.count,3);
 assert.equal(interleaveTravelResults([],result.banners).length,3);assert.equal(travelSearchResults([],[],empty).count,0);
});
test('public resolver retains hiding, replacement, crop and canonical legacy identity',()=>{
 const ad={id:'a',path:'/',placement:'sidebar_top',headline:'active',target_url:'https://example.org/',image_path:'campaigns/a/creative/image.png',imageUrl:'/signed',image_available:true};
 const metadata=[{banner_key:'campaign:a',path:'/',name:'active'}];
 const rows=publicBannerCreatives([ad],[{path:'/',placement:'sidebar_top',size:'small',crop_reference:'campaign:a:campaigns/a/creative/image.png',focus_x:30,focus_y:60,zoom:1.2}],metadata);
 assert.equal(rows.length,1);assert.equal(rows[0].ad.imageUrl,'/signed');assert.equal(rows[0].ad.crop.focus_x,30);
 assert.equal(publicBannerCreatives([{...ad,image_available:false}],[],metadata).length,0);
});
test('inline creative retains public label, sponsored URL, P11, crop and never uses slot admin overrides',()=>{
 const original=banner().ad;
 const html=renderToStaticMarkup(createElement(InlineBannerContext.Provider,{value:{overrides:{sidebar_top:{...original,headline:'Wrong slot override'}},open(){}}},createElement(CampaignSlot,{placement:'sidebar_top',ad:original,searchResult:true})));
 assert.match(html,/Anzeige/);assert.match(html,/sponsored noopener noreferrer/);assert.match(html,/target="_blank"/);assert.match(html,/interactiveCreative/);
 assert.doesNotMatch(html,/Banner bearbeiten|Banner hinzufügen|Wrong slot override/);
 const crop=renderToStaticMarkup(createElement(CampaignSlot,{placement:'sidebar_top',ad:{...original,crop:{focus_x:25,focus_y:75,zoom:1.4}},searchResult:true}));assert.match(crop,/cropImage/);
});

