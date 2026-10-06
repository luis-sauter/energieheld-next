import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit, ScriptTarget } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/link' || specifier === 'next/image') return {url:`data:text/javascript,export default ${JSON.stringify(specifier === 'next/link' ? 'a' : 'img')}`,shortCircuit:true};
    if (specifier.endsWith('.module.css')) return {url:'data:text/javascript,export default {}',shortCircuit:true};
    if (specifier.endsWith('inline-banner-editor')) return {url:'data:text/javascript,export function InlineBannerProvider({children}){return children};export function InlineBannerDialog(){return null}',shortCircuit:true};
    if (specifier === 'next/navigation') return {url:'data:text/javascript,export const useRouter=()=>({refresh(){}})',shortCircuit:true};
    if (specifier.endsWith('inline-banner-actions')) return {url:'data:text/javascript,export async function loadSearchBannerEditor(){return {error:"fixture"}}',shortCircuit:true};
    if (specifier.endsWith('/trades') && context.parentURL.includes('/components/')) return {url:'data:text/javascript,export function AdvertisingLayout({children}){return children}',shortCircuit:true};
    if (specifier.includes('/admin/') && !specifier.endsWith('/freshness-status')) return {url:'data:text/javascript,export function DirectoryOrderEditor(){return null};export function SidebarOrderEditor(){return null}',shortCircuit:true};
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const base = specifier.startsWith('@/') ? new URL('../src/'+specifier.slice(2), import.meta.url) : new URL(specifier,context.parentURL);
      for(const ext of ['.ts','.tsx']) if(existsSync(new URL(base.href+ext))) return next(base.href+ext,context);
    }
    return next(specifier,context);
  },
  load(url,context,next) {
    if(/\.tsx?$/.test(url)) return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX,target:ScriptTarget.ESNext}}).outputText};
    return next(url,context);
  }
});
const {TravelDirectory} = await import('../src/components/portal/travel-directory.tsx');
const {ListingRow} = await import('../src/components/portal/listing-row.tsx');
const {CompanyImage} = await import('../src/components/portal/company-image.tsx');
const {SearchAdResults} = await import('../src/components/advertising/search-ad-results.tsx');
const {readTravelFilterValues} = await import('../src/lib/reiseportal-filter-options.ts');
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const listing=(id,premium=false,image=true)=>({id,slug:id,name:id,initials:'AB',tagline:'Originaler Teaser',description:'Originaltext',directoryPackage:premium?'premium':'basic',directoryImage:image?{src:'/reiseportal/original.jpg',alt:'Originales Anbieterbild'}:undefined,images:[],services:[],categoryIds:[],travelTermKeys:['theme:natur-pur','feature:unknown'],location:{city:'Berlin',country:'Deutschland',postalCode:'10115',region:''},contact:{phone:'+49 123',email:'public@example.com',website:'https://example.com'},isDemo:false});
const terms=[{term_key:'theme:natur-pur',dimension:'theme',slug:'natur-pur',label:'Natur'}];
const directory=(items,values={})=>renderToStaticMarkup(createElement(TravelDirectory,{initialValues:readTravelFilterValues(values),database:items,preview:[],terms,error:null,ads:[],sidebarOrder:[],canReorder:false,hiddenOrderKeys:[]}));

test('search formats render wide before other and every admin card offers existing editor',()=>{
 const banners=[['square',350,350],['wide',350,120],['portrait',200,600]].map(([id,width,height])=>({banner_key:id,advertiser_key:id,ad:{id,headline:id,imageUrl:'/image.png',image_width:width,image_height:height,target_url:'https://example.org/',placement:'sidebar_top'}}));
 const render=canEdit=>renderToStaticMarkup(createElement(SearchAdResults,{banners,filtered:false,canEdit}));
 const publicHtml=render(false),adminHtml=render(true);
 assert.ok(publicHtml.indexOf('data-ad-format-group="wide"')<publicHtml.indexOf('data-ad-format-group="other"'));
 assert.ok(publicHtml.indexOf('data-search-banner="wide"')<publicHtml.indexOf('data-search-banner="square"'));
 assert.doesNotMatch(publicHtml,/Banner bearbeiten|<button/);assert.equal((adminHtml.match(/>Banner bearbeiten<\/button>/g)||[]).length,3);
 assert.equal((publicHtml.match(/data-advertiser=/g)||[]).length,3);assert.equal((publicHtml.match(/id="search-ads-title"/g)||[]).length,1);
});
test('SSR includes every premium/basic profile, true package labels and public links with premium first',()=>{
  const items=[listing('basic'),...Array.from({length:4},(_,i)=>listing('premium-'+i,true))];
  const html=directory(items);
  assert.equal((html.match(/class="listing-row /g)||[]).length,5);
  assert.equal((html.match(/travel-premium-badge/g)||[]).length,4);
  assert.ok(html.indexOf('premium-3')<html.indexOf('href="/unterkuenfte/basic"'));
  assert.match(html,/Premium-Unterkünfte/);assert.match(html,/Weitere Unterkünfte/);
  for(const item of items) assert.match(html,new RegExp(`href="/unterkuenfte/${item.slug}"`));
  assert.doesNotMatch(html,/rating|Bewertungen|Qualitätsprüfung|redaktionell empfohlen/);
  assert.equal((html.match(/<h1 /g)||[]).length,1);
});
test('real card imagery, taxonomy and existing contact visibility are reused; missing premium image does not change package',()=>{
  const render=(item)=>renderToStaticMarkup(createElement(ListingRow,{listing:item,categories:[],href:'/unterkuenfte/'+item.slug,travel:true,showVerification:false,travelLabels:{'theme:natur-pur':'Natur'}}));
  const premium=render(listing('premium',true));const basic=render(listing('basic'));
  assert.match(premium,/Originales Anbieterbild/);assert.match(premium,/Natur/);assert.doesNotMatch(premium,/unknown/);
  assert.match(premium,/mailto:public@example.com/);assert.doesNotMatch(basic,/mailto:/);
  assert.doesNotMatch(basic,/Originales Anbieterbild|<img/);assert.match(basic,/travel-image-fallback/);assert.match(basic,/Zum Profil/);
  const missing=render(listing('missing',true,false));assert.match(missing,/listing-row--premium/);assert.match(missing,/Kein Bild für missing/);assert.doesNotMatch(missing,/<img/);
});
function imageProps(props) { let captured; function Capture() { const image=CompanyImage(props); captured=image.props; return image; } renderToStaticMarkup(createElement(Capture)); return captured; }
test('private URLs keep bypassing optimizer while local card images opt in with explicit responsive sizes',()=>{
  const local=imageProps({image:{src:'/real.jpg',alt:'real'},cover:true,optimizeLocal:true,sizes:'400px'});
  assert.equal(local.unoptimized,false);assert.equal(local.sizes,'400px');assert.equal(local.style.objectFit,'cover');
  const signed=imageProps({image:{src:'https://project.supabase.co/storage/v1/object/sign/private/image?token=example',alt:'private'},cover:true,optimizeLocal:true});
  assert.equal(signed.unoptimized,true);
  assert.equal(imageProps({image:{src:'/real.jpg',alt:'real'},cover:true}).unoptimized,true);
});
test('A–Z layout is scoped, reserves square images, stacks rail on mobile and keeps shared fixed-slot delivery/editor',()=>{
  const css=source('src/components/portal/travel-directory.module.css');
  assert.match(css,/aspect-ratio: 1/);assert.match(css,/400px/);assert.match(css,/@media \(max-width: 900px\)/);assert.match(css,/@media \(max-width: 600px\)/);
  assert.match(css,/outline: 3px/);
  const directorySource=source('src/components/portal/travel-directory.tsx');
  assert.match(directorySource,/<AdvertisingLayout ads=\{ads\} sidebarOrder=\{sidebarOrder\}/);
  assert.match(directorySource,/<SidebarOrderEditor/);assert.doesNotMatch(directorySource,/compactOverview|slice\(0, 2\)/);
  assert.match(source('src/components/advertising/advertising-rail.tsx'),/defaultSidebarOrder\.map/);
});
test('structured zero state is honest while free text still submits globally without matching accommodations',()=>{
  const html=directory([listing('only',true)],{ort:'Missing place',q:'Nordic Walking'});
  assert.match(html,/Für diese Kombination/);assert.match(html,/Im Reiseportal suchen/);assert.doesNotMatch(html,/type="submit" disabled/);
  assert.match(html,/name="ort"/);assert.match(html,/name="q"/);
});

 test('shared advertising columns contain finder before results, with neutral fallbacks and contained real logos',()=>{
 const code=source('src/components/portal/travel-directory.tsx');
 assert.ok(code.indexOf('{finder}') < code.indexOf('<section id="unterkunft-ergebnisse"'));
 assert.match(code,/renderFinder=/);
 const fallback=renderToStaticMarkup(createElement(ListingRow,{listing:listing('missing',false,false),categories:[],href:'/missing',travel:true}));
 assert.match(fallback,/travel-image-fallback/);assert.match(fallback,/<svg/);assert.doesNotMatch(fallback,/>AB</);
 const item=listing('logo',true);item.logo=item.directoryImage;
 const html=renderToStaticMarkup(createElement(ListingRow,{listing:item,categories:[],href:'/logo',travel:true}));
 assert.match(html,/row-logo--contain/);assert.match(html,/object-fit:contain/);
 const css=source('src/components/portal/travel-directory.module.css');
 assert.match(css,/220px/);assert.match(css,/72px/);assert.match(css,/background: rgb\(255 255 255 \/ 96%\)/);
 assert.match(code,/premiumInSidebar showEmptySlots=\{Boolean\(bannerOptions\)\}/);
 assert.match(css,/\.listing-row--premium \.travel-card-tags\) \{ margin-top: auto/);
 assert.match(css,/\.listing-row--premium \.row-contact\).*align-self: stretch/);
 assert.match(css,/height: 640px/);
 });

test('advertiser results render once after all listings, retain packages and support banner-only filters',()=>{
 const ad={id:'campaign',placement:'sidebar_top',headline:'Öffentliche Anzeige',imageUrl:'/real-creative.png',image_path:null,target_url:'https://example.org/'};
 const banner={banner_key:'campaign:campaign',profile_id:'premium',term_keys:['theme:wellnessangebote'],city:'Bannerstadt',postal_code:'99999',ad};
 const render=(database,values=readTravelFilterValues({}))=>renderToStaticMarkup(createElement(TravelDirectory,{database,preview:[],terms:[],error:null,ads:[],sidebarOrder:[],canReorder:false,hiddenOrderKeys:[],initialValues:values,banners:[banner]}));
 const html=render([listing('premium',true),listing('basic')]);
 assert.match(html,/3 Ergebnisse anzeigen/);assert.equal((html.match(/data-search-banner=/g)||[]).length,1);
 assert.ok(html.indexOf('href="/unterkuenfte/premium"')<html.indexOf('data-search-banner='));
 assert.ok(html.indexOf('data-search-banner=')>html.indexOf('href="/unterkuenfte/basic"')); assert.match(source('src/components/advertising/search-ad-results.module.css'),/repeat\(2, minmax\(0, 1fr\)\)/); assert.equal((html.match(/id="search-ads-title"/g)||[]).length,1);
 assert.match(html,/Anzeige/);assert.match(html,/sponsored noopener noreferrer/);
 const only=render([listing('premium',true)],readTravelFilterValues({ort:'99999'}));
 assert.match(only,/1 Ergebnis anzeigen/);assert.match(only,/data-search-banner=/);assert.doesNotMatch(only,/aktuell keine passende Unterkunft/);
 const none=render([],readTravelFilterValues({ort:'unmatched'}));assert.match(none,/aktuell keine passende Unterkunft/);assert.doesNotMatch(none,/data-search-banner=/);
});
