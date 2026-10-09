import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {transpileModule,ModuleKind,JsxEmit,ScriptTarget} from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='next/navigation')return {shortCircuit:true,url:'data:text/javascript,export const useRouter=()=>({refresh(){}})'};
  if(specifier.endsWith('/admin/mediathek/actions'))return {shortCircuit:true,url:'data:text/javascript,export async function searchLibraryProfiles(){throw Error("Unexpected remote company search")};export async function createLibraryCompany(){throw Error("Unexpected company creation")}'};
  if(specifier==='next/link'||specifier==='next/image')return {url:`data:text/javascript,export default ${JSON.stringify(specifier==='next/link'?'a':'img')}`,shortCircuit:true};
  if(specifier.endsWith('.module.css'))return {url:'data:text/javascript,export default new Proxy({}, {get:(_,key)=>key})',shortCircuit:true};
  if(specifier.startsWith('@/')||specifier.startsWith('.')){
   const base=specifier.startsWith('@/')?new URL('../src/'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);
   for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,context);
  }return next(specifier,context);
 },
 load(url,context,next){if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ES2022}}).outputText};return next(url,context);}
});
const {matchTravelSearchBanners,travelSearchResults,travelSearchAdvertisers,selectBestAdvertiserCreative}=await import('../src/lib/travel-search-banners.ts');
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
test('count uses advertisers, Home and Directory agree, distinct creatives of one customer count once',()=>{
 const listings=Array.from({length:59},(_,i)=>listing(String(i)));
 const banners=Array.from({length:4},(_,i)=>banner(`legacy:hoeflehner${i}`,{advertiser_key:'hoeflehner'}));
 banners.push(...Array.from({length:3},(_,i)=>banner(`legacy:rhoen${i}`,{advertiser_key:'rhoen'})));
 const result=travelSearchResults(listings,[...banners,...banners],empty);assert.equal(result.count,61);assert.equal(result.advertisers.length,2);
 for(const mode of ['home','directory'])assert.match(renderToStaticMarkup(createElement(TravelFinder,{mode,listings,banners,options:availableTravelFilters(listings,[]),values:empty,onChange(){}})),/61 Ergebnisse anzeigen/);
});
test('profile identity is stable; uncertain legacy creatives remain distinct; internal promos excluded',()=>{
 const rows=[banner('a',{profile_id:'p'}),banner('b',{profile_id:'p'}),banner('unknown1'),banner('unknown2'),banner('portal',{commercial:false}),banner('internal',{ad:{...banner().ad,target_url:'https://das-reiseportal.com/reiseziele'}})];
 assert.equal(travelSearchAdvertisers(rows,empty).length,3);
});
test('canonical no-filter creative, specific metadata selection, deterministic tie, no cross-creative AND',()=>{
 const general=banner('a',{advertiser_key:'same',primary_creative:true,term_keys:[]}),wellness=banner('b',{advertiser_key:'same',term_keys:['theme:wellnessangebote']}),family=banner('c',{advertiser_key:'same',term_keys:['audience:familie']});
 assert.equal(travelSearchAdvertisers([family,wellness,general],empty)[0].banner_key,'a');
 assert.equal(travelSearchAdvertisers([family,wellness,general],{...empty,theme:'wellnessangebote'})[0].banner_key,'b');
 assert.equal(travelSearchAdvertisers([family,wellness],{...empty,theme:'wellnessangebote',audience:'familie'}).length,0);
 assert.equal(selectBestAdvertiserCreative([wellness,banner('d',{term_keys:wellness.term_keys})],{...empty,theme:'wellnessangebote'}).banner_key,'b');
});
test('explicit geography and normalized region match; no booking destination inference',()=>{
 const a=banner('geo',{destination_slugs:['oesterreich'],region:'Tirol'});
 assert.equal(travelSearchAdvertisers([a],{...empty,destination:'oesterreich',location:'tirol'}).length,1);
 assert.equal(travelSearchAdvertisers([a],{...empty,destination:'schweiz'}).length,0);
 assert.equal(travelSearchResults([], [a],empty).count,1);assert.equal(travelSearchResults([],[],empty).count,0);
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


test('search cards have placement-independent geometry and existing public interaction/link semantics',async()=>{
 const {SearchAdCard}=await import('../src/components/advertising/search-ad-card.tsx');
 for(const placement of ['top_banner','sidebar_top','sidebar_04']){
 const html=renderToStaticMarkup(createElement(SearchAdCard,{banner:banner(placement,{advertiser_key:'customer',ad:{...banner().ad,placement,image_width:350,image_height:120,crop:{focus_x:20,focus_y:60,zoom:2}}})}));
 assert.match(html,/data-advertiser="customer"/);assert.match(html,/interactiveCreative/);assert.match(html,/sponsored noopener noreferrer/);assert.match(html,/loading="lazy"/);assert.doesNotMatch(html,/cropImage|data-placement|data-size|Banner bearbeiten/);
 }
 const css=readFileSync(new URL('../src/components/advertising/search-ad-card.module.css',import.meta.url),'utf8');assert.match(css,/object-fit: contain/);assert.match(css,/aspect-ratio: 1 \/ 1/);assert.match(css,/height: auto/);
});
test('same existing inline fields expose customer, explicit geography and taxonomy without booking keys',async()=>{
 const {BannerSearchFields}=await import('../src/components/advertising/banner-search-fields.tsx');
 const html=renderToStaticMarkup(createElement(BannerSearchFields,{value:{name:'Example',postal_code:'',city:'',term_keys:[],destination_slugs:['oesterreich']},terms:[],advertisers:[{key:'domain:example.org',name:'Example company'}],onChange(){}}));
 for(const text of ['Suchzuordnung','Werbekunde','Land / Reiseziel','Region','PLZ','Ort','Allgemeiner Hauptbanner'])assert.ok(html.includes(text));
 assert.match(html,/name="banner_destinations"/);assert.match(html,/Österreich/);
});


test('audience results count advertisers once and use honest public result labels',()=>{
 const rows=[banner('a',{advertiser_key:'dog-customer',term_keys:['audience:mit-hund']}),banner('b',{advertiser_key:'dog-customer',term_keys:['audience:mit-hund']})];
 const values={...empty,audience:'mit-hund'};
 const html=renderToStaticMarkup(createElement(TravelFinder,{mode:'home',listings:[],banners:rows,options:availableTravelFilters([],[]),values,onChange(){}}));
 assert.match(html,/1 Ergebnis anzeigen/);assert.match(html,/1 passendes Ergebnis/);assert.doesNotMatch(html,/1 passende Unterkunft/);
 const normal=renderToStaticMarkup(createElement(TravelFinder,{mode:'directory',listings:[listing('real')],options:availableTravelFilters([],[]),values:empty,onChange(){}}));
 assert.match(normal,/1 Unterkunft anzeigen/);assert.match(normal,/1 passende Unterkunft/);
 assert.equal(travelSearchResults([],rows,values).count,1);
});


test('retired public feature URL does not exclude banners or change advertiser counts and audience matching',()=>{
 const banners=[banner(),banner('campaign:no-feature',{term_keys:['audience:paar']}),banner('campaign:family',{term_keys:['audience:familie']})];
 const profiles=[{...listing('couple'),travelTermKeys:['audience:paar']},listing('other')];
 for(const besonderheit of ['sauna','unknown']) {
  assert.deepEqual(travelSearchResults(profiles,banners,readTravelFilterValues({besonderheit})),travelSearchResults(profiles,banners,empty));
  const selected=readTravelFilterValues({besonderheit,zielgruppe:'paar'});
  const result=travelSearchResults(profiles,banners,selected);
  assert.equal(result.count,3);assert.equal(result.advertisers.length,2);
  assert.deepEqual(result,travelSearchResults(profiles,banners,{...empty,audience:'paar'}));
 }
});
