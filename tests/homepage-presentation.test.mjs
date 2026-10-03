import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const slugs = ['golfhotel-andreus','bayerischer-wald','hoeflehner','schafhuber'];
const profiles = slugs.map(slug=>({id:slug,slug,name:slug,initials:'AB',tagline:'Bestehender Profiltext',description:'',categoryIds:[],travelTermKeys:['theme:natur-pur'],location:{city:'Ort',country:'Deutschland',postalCode:'',region:''},images:[{src:'/reiseportal/hero.jpg',alt:'Vorhandenes Foto'}],services:[],isDemo:false,contact:{email:'',phone:'',website:''}}));
globalThis.homeFixture = {profiles, ads:[{id:'existing',placement:'top_banner'}], calls:[]};
const stubs = {
 '@/lib/reiseportal-directory': 'export async function loadReiseportalDirectory(){globalThis.homeFixture.calls.push("directory");return {database:globalThis.homeFixture.profiles,preview:[],error:null};}',
 '@/lib/public-travel-taxonomy':'export async function loadPublicTravelTerms(){return [];}',
 '@/lib/public-ads':'export async function loadPublicAds(_,area){globalThis.homeFixture.calls.push(area);return globalThis.homeFixture.ads;}',
 '@/lib/public-sidebar-order':'export async function loadPublicSidebarOrder(){return ["sidebar_top"];}',
 '@/lib/inline-advertising-loader':'export async function loadInlineBannerOptions(path){globalThis.homeFixture.calls.push(path);return undefined;}',
 '@/components/advertising/inline-banner-editor':'export function InlineBannerProvider({children}){return children;}',
 '@/components/advertising/campaign-view':'import {createElement} from "react";export function CampaignSlot({placement,ad}){return ad ? createElement("aside",{"data-placement":placement},ad.id):null;}',
 '@/components/advertising/advertising-rail':'import {createElement} from "react";export function AdvertisingRail({ads}){return createElement("aside",{"aria-label":"Werbeanzeigen","data-ad-count":ads.length});}',
 '@/components/advertising/discovery-advertising':'export function DiscoveryAdvertising({children}){return children;}',
};
registerHooks({
 resolve(specifier,context,next){
  if(specifier === 'server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
  if(specifier === "react" && context.parentURL?.startsWith("data:"))return next(specifier,{...context,parentURL:import.meta.url});
  if(stubs[specifier])return {url:'data:text/javascript,'+encodeURIComponent(stubs[specifier]),shortCircuit:true};
  if(specifier.endsWith('.css'))return {url:'data:text/javascript,export default '+encodeURIComponent(JSON.stringify(Object.fromEntries(['page','quicklinks','mosaic','destinations','premium','stays','provider','inspiration','showcase','featuredStay','recommendations','partners'].map(k=>[k,k])))),shortCircuit:true};
  if(specifier==='next/link')return {url:'data:text/javascript,export default "a"',shortCircuit:true};
  if(specifier==='next/image')return {url:'data:text/javascript,'+encodeURIComponent('import {createElement} from "react";export default function Image({fill,unoptimized,priority,...p}){return createElement("img",p);}'),shortCircuit:true};
  if(specifier.startsWith('@/')||specifier.startsWith('.')){
   const base=specifier.startsWith('@/')?new URL('../src/'+specifier.slice(2),import.meta.url):new URL(specifier,context.parentURL);
   for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,context);
  }
  return next(specifier,context);
 },
 load(url,context,next){if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,context);}
});
const {default:Home}=await import('../src/app/(energieheld)/page.tsx');
const {DiscoveryCard}=await import('../src/components/portal/reise-overview.tsx');
const {AccommodationCard}=await import('../src/components/portal/discovery-detail.tsx');
const {travelThemes,destinations}=await import('../src/data/reiseportal-discovery.ts');
test('homepage composes existing search, four themes, four destinations and real featured profiles as server HTML',async()=>{
 globalThis.homeFixture.calls=[];
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({q:'Nordic Walking',ziel:'schweiz'})}));
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/value="Nordic Walking"/);assert.match(html,/Im Reiseportal suchen/);
 for(const slug of ['natur-pur','familienurlaub','wanderurlaub','wellnessangebote'])assert.match(html,new RegExp('href="/mottoreisen/'+slug+'"'));
 for(const d of destinations)assert.match(html,new RegExp('href="/reiseziele/'+d.slug+'"'));
 for(const slug of slugs)assert.match(html,new RegExp('href="/unterkuenfte/'+slug+'"'));
 assert.match(html,/href="\/registrieren"/);
 assert.match(html,/data-placement="top_banner"/);assert.match(html,/aria-label="Werbeanzeigen"/);
 assert.deepEqual(globalThis.homeFixture.calls,['homepage','directory','/']);
 assert.doesNotMatch(html,/iframe|maps.googleapis|Merkliste|Bewertungen/);
});
test('homepage never fills missing selected profiles with fabricated cards',async()=>{
 const original=globalThis.homeFixture.profiles;
 try{globalThis.homeFixture.profiles=[profiles[0]];const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));assert.equal((html.match(/<article class="accommodation-card"/g)||[]).length,1);assert.doesNotMatch(html,/\/unterkuenfte\/pension-sonnenhof/);}finally{globalThis.homeFixture.profiles=original;}
});
test('all homepage editorial imagery reuses existing redesigned assets',()=>{
 for(const slug of ['natur-pur','familienurlaub','wanderurlaub','wellnessangebote'])assert.ok(existsSync(new URL('../public/reiseportal/redesign/mottoreisen/'+slug+'.webp',import.meta.url)));
 for(const d of destinations)assert.ok(existsSync(new URL('../public/reiseportal/redesign/reiseziele/'+d.slug+'.webp',import.meta.url)));
});
test('shared cards accept measured sizes and keep lazy loading and real profile links',()=>{
 for(const component of [createElement(DiscoveryCard,{entry:travelThemes[0],basePath:'/mottoreisen',sizes:'740px'}),createElement(AccommodationCard,{listing:profiles[0],sizes:'430px'})]){
 const html=renderToStaticMarkup(component);assert.match(html,/loading="lazy"/);assert.match(html,/sizes="(?:740|430)px"/);assert.match(html,/href="\/(?:mottoreisen|unterkuenfte)\//);
 }
 const legacy=renderToStaticMarkup(createElement(DiscoveryCard,{entry:travelThemes[0],basePath:'/mottoreisen'}));assert.match(legacy,/25vw/);
});
test('homepage presentation is scoped, responsive, reserves image geometry and respects reduced motion',()=>{
 const css=read('src/app/(energieheld)/home.module.css');
 assert.match(css,/grid-template-rows: repeat\(3, 145px\)/);assert.match(css,/grid-row: span 3/);
 assert.match(css,/@media \(max-width: 1100px\)/);assert.match(css,/repeat\(4, minmax\(0, 1fr\)\)/);
 assert.match(css,/@media \(max-width: 700px\)/);assert.match(css,/repeat\(2, minmax\(0, 1fr\)\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);assert.match(css,/aspect-ratio: 1.7/);
 assert.doesNotMatch(read('src/app/(energieheld)/page.tsx'),/use client|maps.googleapis|iframe/);
});
test('editorial showcase separates one featured stay and three compact recommendations from all homepage ads', async () => {
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
 assert.equal((html.match(/<article class="accommodation-card"/g)||[]).length,4);
 assert.match(html,/<div class="featuredStay"><article/);
 const recommendations=html.split('<div class="recommendations">')[1].split('</section>')[0];
 assert.equal((recommendations.match(/<article/g)||[]).length,3);
 const stays=html.split('aria-labelledby="stays-title"')[1].split('</section>')[0];
 assert.doesNotMatch(stays,/Werbeanzeigen|data-placement/);
 assert.ok(html.indexOf('stays-title') < html.indexOf('partners-title'));
 assert.ok(html.indexOf('partners-title') < html.indexOf('data-placement="top_banner"'));
 assert.ok(html.indexOf('Werbeanzeigen') < html.indexOf('provider-title'));
 assert.match(html,/data-ad-count="1"/);
});
test('curation uses visually checked provider originals without changing canonical profile galleries or accepting demo profiles', async () => {
 const original=JSON.stringify(profiles);
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
 for(const [slug,file] of [['golfhotel-andreus','04'],['bayerischer-wald','01'],['hoeflehner','01'],['schafhuber','04']]) {
  const src='/reiseportal/unterkuenfte/'+slug+'/'+file+'.jpg';
  assert.match(html,new RegExp(src));assert.ok(existsSync(new URL('../public'+src,import.meta.url)));
 }
 assert.equal(JSON.stringify(profiles),original);
 try {
  globalThis.homeFixture.profiles=profiles.map(p=>({...p,isDemo:true}));
  assert.doesNotMatch(renderToStaticMarkup(await Home({searchParams:Promise.resolve({})})),/class="accommodation-card"/);
 } finally {globalThis.homeFixture.profiles=profiles;}
});
test('homepage ad grid preserves stored size and crop renderer and shared vertical reorder interaction', () => {
 const css=read('src/app/(energieheld)/home.module.css');
 assert.match(css,/repeat\(3, minmax\(0, 1fr\)\)/);
 assert.match(css,/grid-row: span 3/);
 assert.match(css,/aria-label\$="verschieben"/);
 assert.match(css,/max-width: 400px/);
 assert.doesNotMatch(css,/object-fit: (?:cover|fill)|grid-auto-flow: dense/);
 assert.doesNotMatch(read('src/app/(energieheld)/page.tsx'),/update\(|delete\(|insert\(|company_ad_campaign_targets/);
});

test('all existing Premium and A–J ads reach the unchanged shared advertising components', async () => {
 const original=globalThis.homeFixture.ads;
 try {
  globalThis.homeFixture.ads=[{id:'premium',placement:'top_banner'},...['sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10'].map((placement,i)=>({id:'legacy-'+i,placement}))];
  const before=JSON.stringify(globalThis.homeFixture.ads);
  const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
  assert.match(html,/data-ad-count="11"/);
  assert.equal((html.match(/data-placement="top_banner"/g)||[]).length,1);
  assert.equal(JSON.stringify(globalThis.homeFixture.ads),before);
 } finally {globalThis.homeFixture.ads=original;}
});
