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
globalThis.homeFixture = {profiles, ads:[{id:'existing',placement:'top_banner',imageUrl:'/existing.jpg'}], calls:[]};
const stubs = {
 '@/lib/profile-card-images':'export async function loadCardEditing(){return false;} export async function withSavedCardImages(rows){return rows;}',
 './card-image-editor':'export function CardImageEditor(){return null;}',
 '@/lib/reiseportal-directory': 'export async function loadReiseportalDirectory(){globalThis.homeFixture.calls.push("directory");return {database:globalThis.homeFixture.profiles,preview:[],error:null};}',
 '@/lib/public-travel-taxonomy':'export async function loadPublicTravelTerms(){return globalThis.homeFixture.terms ?? [];}',
 '@/lib/public-ads':'export async function loadPublicAds(_,area){globalThis.homeFixture.calls.push(area);return globalThis.homeFixture.ads;}',
 '@/lib/public-sidebar-order':'export async function loadPublicSidebarOrder(){return ["sidebar_top"];}',
 '@/lib/inline-advertising-loader':'export async function loadInlineBannerOptions(path){globalThis.homeFixture.calls.push(path);return undefined;}',
 '@/components/advertising/inline-banner-editor':'export function InlineBannerProvider({children}){return children;}',
 '@/components/advertising/campaign-view':'import {createElement} from "react";export function CampaignSlot({placement,ad}){return ad ? createElement("aside",{"data-placement":placement},ad.id):null;}',
 '@/components/advertising/advertising-rail':'import {createElement} from "react";export function AdvertisingRail({ads,visibleSlots}){const rows=ads.filter(ad=>!visibleSlots||visibleSlots.includes(ad.placement));return createElement("aside",{"aria-label":"Werbeanzeigen","data-ad-count":rows.length});}',
 '@/components/advertising/discovery-advertising':'export function DiscoveryAdvertising({children}){return children;}',
};
stubs['./advertising-rail']=stubs['@/components/advertising/advertising-rail'];
stubs['./campaign-view']=stubs['@/components/advertising/campaign-view'];
registerHooks({
 resolve(specifier,context,next){
  if(specifier === 'server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
  if(specifier === "react" && context.parentURL?.startsWith("data:"))return next(specifier,{...context,parentURL:import.meta.url});
  if(stubs[specifier])return {url:'data:text/javascript,'+encodeURIComponent(stubs[specifier]),shortCircuit:true};
  if(specifier.endsWith('.css'))return {url:'data:text/javascript,export default '+encodeURIComponent(JSON.stringify(Object.fromEntries(['page','quicklinks','mosaic','destinations','premium','stays','provider','inspiration','showcase','featuredStay','recommendations','partners','header','controls','rail','scroller'].map(k=>[k,k])))),shortCircuit:true};
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
const {discoveryAudienceShortcuts}=await import('../src/lib/discovery-shortcuts.ts');
const {filterTravelListings}=await import('../src/lib/reiseportal-facets.ts');
const {readTravelFilterValues}=await import('../src/lib/reiseportal-filter-options.ts');
test('homepage composes existing search, all central themes, four destinations and real featured profiles as server HTML',async()=>{
 globalThis.homeFixture.calls=[];
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({q:'Nordic Walking',ziel:'schweiz'})}));
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.match(html,/value="Nordic Walking"/);assert.match(html,/Im Reiseportal suchen/);
 for(const {slug} of travelThemes){assert.match(html,new RegExp('href="/mottoreisen/'+slug+'"'));assert.match(html,new RegExp('href="/unterkuenfte-a-z\\?thema='+slug+'"'));}
 for(const d of destinations)assert.match(html,new RegExp('href="/reiseziele/'+d.slug+'"'));
 for(const slug of slugs)assert.match(html,new RegExp('href="/unterkuenfte/'+slug+'"'));
 assert.match(html,/href="\/registrieren"/);
 assert.match(html,/data-placement="top_banner"/);assert.match(html,/aria-label="Premium-Anzeige"/);
 assert.deepEqual(globalThis.homeFixture.calls,['homepage','directory','/']);
 assert.doesNotMatch(html,/iframe|maps.googleapis|Merkliste|Bewertungen/);
});
test('homepage never fills missing selected profiles with fabricated cards',async()=>{
 const original=globalThis.homeFixture.profiles;
 try{globalThis.homeFixture.profiles=[profiles[0]];const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));assert.equal((html.match(/<article class="accommodation-card"/g)||[]).length,1);assert.doesNotMatch(html,/\/unterkuenfte\/pension-sonnenhof/);}finally{globalThis.homeFixture.profiles=original;}
});
test('all homepage editorial imagery reuses existing redesigned assets',()=>{
 for(const {slug} of travelThemes)assert.ok(existsSync(new URL('../public/reiseportal/redesign/mottoreisen/'+slug+'.webp',import.meta.url)));
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
 const scroller=read("src/components/portal/theme-scroller.module.css"); assert.match(scroller,/display: flex/); assert.match(scroller,/scroll-snap-type: x mandatory/); assert.match(css,/rgb\(255 255 255 \/ 86%\)/);
 assert.match(css,/@media \(max-width: 1100px\)/);assert.match(scroller,/100% - 30px/);
 assert.match(css,/@media \(max-width: 700px\)/);assert.match(css,/repeat\(2, minmax\(0, 1fr\)\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);assert.match(css,/aspect-ratio: 1.7/);
 assert.doesNotMatch(read('src/app/(energieheld)/page.tsx'),/use client|maps.googleapis|iframe/);
});
test('homepage retains selected providers in one equal grid and follows the required fixed-slot sequence', async () => {
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
 assert.equal((html.match(/<article class="accommodation-card"/g)||[]).length,4);
 const stays=html.split('aria-labelledby="stays-title"')[1].split('</section>')[0];
 assert.match(stays,/<div class="showcase">/);assert.doesNotMatch(stays,/featuredStay|recommendations|data-placement/);
 assert.ok(html.indexOf('inspiration-title') < html.indexOf('data-placement="top_banner"'));
 assert.ok(html.indexOf('data-placement="top_banner"') < html.indexOf('destinations-title'));
 assert.ok(html.indexOf('destinations-title') < html.indexOf('stays-title'));
 const source=read('src/app/(energieheld)/page.tsx');
 assert.ok(source.indexOf('</nav>') < source.indexOf('placements={["sidebar_top"'));
 assert.ok(source.indexOf('placements={["sidebar_top"') < source.indexOf('aria-labelledby="inspiration-title"'));
 assert.ok(source.indexOf('placements={["sidebar_04"') > source.indexOf('aria-labelledby="destinations-title"'));
 assert.ok(source.indexOf('placements={["sidebar_04"') < source.indexOf('aria-labelledby="stays-title"'));
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

test('only Premium and A–F ads appear publicly while stored G–J campaigns stay intact', async () => {
 const original=globalThis.homeFixture.ads;
 try {
  globalThis.homeFixture.ads=[{id:'premium',placement:'top_banner',imageUrl:'/premium.jpg'},...['sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10'].map((placement,i)=>({id:'legacy-'+i,placement,imageUrl:'/existing.jpg'}))];
  const before=JSON.stringify(globalThis.homeFixture.ads);
  const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
  assert.equal((html.match(/data-ad-count="3"/g)||[]).length,2);assert.doesNotMatch(html,/data-ad-count="4"|Weitere Banner verwalten/);
  assert.equal((html.match(/data-placement="top_banner"/g)||[]).length,1);
  assert.equal(JSON.stringify(globalThis.homeFixture.ads),before);
 } finally {globalThis.homeFixture.ads=original;}
});

test('homepage controls share the inspiration heading and compact shortcuts have no playback controls',async()=>{
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
 const compact=html.split('<nav')[1].split('</nav>')[0];
 assert.equal((compact.match(/data-theme-image="true"/g)||[]).length,travelThemes.length+3);
 assert.doesNotMatch(compact,/<button/);
 const inspiration=html.split('aria-labelledby="inspiration-title"')[1].split('</section>')[0];
 const header=inspiration.split('<div class="header">')[1].split('<div class="rail"')[0];
 assert.match(header,/id="inspiration-title"/);assert.match(header,/Alle Mottoreisen/);
 assert.match(header,/Inspiration &amp; Themenwelten: zurück/);assert.match(header,/Inspiration &amp; Themenwelten: weiter/);
 assert.equal((inspiration.match(/class="discovery-card"/g)||[]).length,travelThemes.length);
 assert.doesNotMatch(inspiration,/Automatischen Wechsel|aria-pressed/);
});


test('audience shortcuts appear first with public labels, unchanged audience links and a local dog illustration',async()=>{
 try{
  globalThis.homeFixture.terms=[{term_key:'audience:paar',dimension:'audience',slug:'paar',label:'Paar'},{term_key:'audience:familie',dimension:'audience',slug:'familie',label:'Familie'},{term_key:'audience:mit-hund',dimension:'audience',slug:'mit-hund',label:'Mit Hund'}];
  const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));const compact=html.split('<nav')[1].split('</nav>')[0];
  const links=[...compact.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(links.slice(0,3),['/unterkuenfte-a-z?zielgruppe=mit-hund','/unterkuenfte-a-z?zielgruppe=familie','/unterkuenfte-a-z?zielgruppe=paar']);
  assert.deepEqual(links.slice(3),travelThemes.map(entry=>'/unterkuenfte-a-z?thema='+entry.slug));
  for(const [slug,label] of [['mit-hund','Mit Hund'],['familie','Mit Kindern'],['paar','Zu zweit']]){
   const card=compact.split('href="/unterkuenfte-a-z?zielgruppe='+slug+'"')[1].split('</a>')[0];
   assert.ok(card.includes('>'+label+'</span>'));
   assert.match(card,/loading="lazy"/);assert.match(card,/alt=""/);
  }
  for(const [slug,image] of [['paar','romantik-zu-zweit'],['familie','familienurlaub']]){const card=compact.split('href="/unterkuenfte-a-z?zielgruppe='+slug+'"')[1].split('</a>')[0];assert.match(card,/<img/);assert.ok(card.includes(image+'.webp'));}
  const dog=compact.split('href="/unterkuenfte-a-z?zielgruppe=mit-hund"')[1].split('</a>')[0];
  assert.match(dog,/src="\/reiseportal\/quicklinks\/mit-hund.webp"/);
  assert.match(dog,/travel-quicklink-icon/);
  const graphic=readFileSync(new URL('../public/reiseportal/quicklinks/mit-hund.webp',import.meta.url));
  assert.equal(graphic.toString('ascii',0,4),'RIFF');
  assert.equal(graphic.toString('ascii',8,12),'WEBP');
  assert.ok(graphic.length < 100_000);
  assert.equal((compact.match(/data-theme-image="true"/g)||[]).length,travelThemes.length+3);
  assert.equal((html.match(/data-travel-quicklinks/g)||[]).length,1);
  assert.deepEqual(globalThis.homeFixture.terms.map(t=>[t.term_key,t.slug,t.label]),[
   ['audience:paar','paar','Paar'],['audience:familie','familie','Familie'],['audience:mit-hund','mit-hund','Mit Hund']]);
  // Public RLS omits terms without an approved assignment. Navigation stays
  // available; it must not manufacture a profile assignment or hide the dog link.
  globalThis.homeFixture.terms=[];
  const empty=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));
  for(const slug of ['mit-hund','familie','paar'])assert.ok(empty.includes('href="/unterkuenfte-a-z?zielgruppe='+slug+'"'));
 }finally{delete globalThis.homeFixture.terms;}
});
test('full inspiration rail renders every central theme with an existing image and valid destination',async()=>{
 const html=renderToStaticMarkup(await Home({searchParams:Promise.resolve({})}));const inspiration=html.split('aria-labelledby="inspiration-title"')[1].split('</section>')[0];
 assert.equal((inspiration.match(/class="discovery-card"/g)||[]).length,travelThemes.length);
 assert.equal((inspiration.match(/<img /g)||[]).length,travelThemes.length);
 for(const {slug} of travelThemes){assert.ok(inspiration.includes('/mottoreisen/'+slug+'"'));assert.ok(inspiration.includes('/mottoreisen/'+slug+'.webp'));}
});

test('audience shortcut deep links reuse existing facet filtering, survive URL reload and never invent terms',()=>{
 const terms=['paar','familie','mit-hund'].map(slug=>({term_key:'audience:'+slug,dimension:'audience',slug,label:slug}));
 const shortcuts=discoveryAudienceShortcuts();
 assert.deepEqual(shortcuts.map(s=>s.slug),['mit-hund','familie','paar']);
 const audienceProfiles=terms.map((term,index)=>({...profiles[index],travelTermKeys:[term.term_key]}));
 for(const shortcut of shortcuts){
  const path='/unterkuenfte-a-z?zielgruppe='+encodeURIComponent(shortcut.slug);
  const values=readTravelFilterValues(Object.fromEntries(new URL(path,'https://portal.invalid').searchParams));
  const matching=filterTravelListings(audienceProfiles,values);
  assert.deepEqual(matching.map(p=>p.id),[audienceProfiles.find(p=>p.travelTermKeys.includes('audience:'+shortcut.slug)).id]);
  const reloaded=readTravelFilterValues(Object.fromEntries(new URL(path,'https://portal.invalid').searchParams));
  assert.deepEqual(filterTravelListings(audienceProfiles,reloaded).map(p=>p.id),matching.map(p=>p.id));
 }
 const dog=readTravelFilterValues({zielgruppe:'mit-hund'});
 assert.deepEqual(filterTravelListings(audienceProfiles.filter(p=>!p.travelTermKeys.includes('audience:mit-hund')),dog),[]);
 const seed=read('supabase/migrations/20260926160000_reiseportal_travel_taxonomy.sql');
 for(const shortcut of shortcuts)assert.ok(seed.includes("('audience:"+shortcut.slug+"', 'audience', '"+shortcut.slug+"'"));
 assert.deepEqual(terms.map(t=>t.term_key),['audience:paar','audience:familie','audience:mit-hund']);
});


test('central audience labels and assigned icons render in cards and profile header without text inference',async()=>{
 const {publicTravelLabel,profileTravelSignals}=await import('../src/lib/travel-presentation.ts');
 const {TravelSignals}=await import('../src/components/portal/travel-signals.tsx');
 const {ListingRow}=await import('../src/components/portal/listing-row.tsx');
 const {ListingDetail}=await import('../src/components/portal/listing-detail.tsx');
 for(const [key,label] of [['familie','Mit Kindern'],['paar','Zu zweit'],['mit-hund','Mit Hund']])assert.equal(publicTravelLabel('audience:'+key,key),label);
 assert.equal(publicTravelLabel('audience:gruppe','Gruppe'),'Gruppe');
 const keys=['accommodation:pension','theme:radwandern','theme:nordic-walking'];
 const listing={...profiles[0],name:'Pension Sonnenhof',travelTermKeys:keys,directoryPackage:'basic'};
 for(const Component of [AccommodationCard,ListingRow,ListingDetail]){
  const html=renderToStaticMarkup(createElement(Component,{listing,categories:[],href:'/unterkuenfte/pension-sonnenhof',travel:true,showVerification:false}));
  assert.match(html,/data-travel-term="theme:radwandern"/);assert.match(html,/data-travel-term="theme:nordic-walking"/);assert.match(html,/<svg/);assert.doesNotMatch(html,/data-travel-term="audience:mit-hund"/);
 }
 const all=[...keys,'audience:familie','audience:paar','audience:mit-hund','theme:wellnessangebote'];
 const selected=profileTravelSignals(all);assert.equal(selected.length,4);assert.equal(selected[0].key,'audience:mit-hund');assert.equal(new Set(selected.map(s=>s.key)).size,4);
 assert.equal(renderToStaticMarkup(createElement(TravelSignals,{termKeys:[]})),'');
 assert.doesNotMatch(renderToStaticMarkup(createElement(AccommodationCard,{listing:{...listing,travelTermKeys:[],description:'Hunde Familie Radwandern'}})),/data-travel-term=/);
 const row=renderToStaticMarkup(createElement(ListingRow,{listing,categories:[],href:'/unterkuenfte/pension-sonnenhof',travel:true}));assert.match(row,/travel-image-fallback/);assert.doesNotMatch(row,/<img/);
 for(const file of ['src/app/(energieheld)/suche/page.tsx','src/components/portal/listings.tsx'])assert.match(read(file),/TravelSignals/);
 const {availableTravelFilters,activeTravelFilterLabels,readTravelFilterValues}=await import('../src/lib/reiseportal-filter-options.ts');
 const terms=['familie','paar','mit-hund'].map(slug=>({term_key:'audience:'+slug,slug,dimension:'audience',label:slug==='familie'?'Familie':slug==='paar'?'Paar':'Mit Hund'}));
 const options=availableTravelFilters([{...listing,travelTermKeys:terms.map(t=>t.term_key)}],terms);
 assert.deepEqual(options.audiences.map(e=>e.label),['Mit Kindern','Zu zweit','Mit Hund']);
 assert.deepEqual(activeTravelFilterLabels(readTravelFilterValues({zielgruppe:'familie'}),options),['Mit wem: Mit Kindern']);
});


test('Carola accommodation card has one whole-card profile link, true signals and no nested interactive elements',()=>{
 const listing={...profiles[0],name:'Ein sehr langer belegter Unterkunftsname mit mehreren Wörtern',location:{...profiles[0].location,city:'Dorf',region:'Region'},travelTermKeys:['theme:natur-pur','theme:wanderurlaub']};
 const before=JSON.stringify(listing);
 const html=renderToStaticMarkup(createElement(AccommodationCard,{listing}));
 assert.equal((html.match(/<a\b/g)||[]).length,1);assert.match(html,/href="\/unterkuenfte\/golfhotel-andreus"/);
 assert.match(html,/<h3>Ein sehr langer belegter Unterkunftsname mit mehreren Wörtern<\/h3>/);
 assert.match(html,/Dorf · Region · Deutschland/);assert.match(html,/data-travel-term="theme:natur-pur"/);
 assert.match(html,/Details ansehen/);assert.doesNotMatch(html,/<button|Merkliste|Favorit|Bewertung|★/);
 assert.equal(JSON.stringify(listing),before);
});
test('same accommodation presentation for home, themes and destinations; no photo or term is invented',()=>{
 const listing={...profiles[0],directoryPackage:'basic'};
 const ordinary=renderToStaticMarkup(createElement(AccommodationCard,{listing,sizes:'430px'}));
 const rotated=renderToStaticMarkup(createElement(AccommodationCard,{listing,rotating:true,sizes:'430px'}));
 assert.equal(ordinary,rotated);assert.match(ordinary,/Vorhandenes Foto/);
 const empty=renderToStaticMarkup(createElement(AccommodationCard,{listing:{...listing,travelImage:null,travelTermKeys:[]}}));
 assert.doesNotMatch(empty,/<img|data-travel-term=/);assert.match(empty,/accommodation-card-image--empty/);assert.match(empty,/Details ansehen/);
 for(const route of ['reiseziele','mottoreisen'])assert.match(read(`src/app/(energieheld)/${route}/[slug]/page.tsx`),/<DiscoveryDetail/);
});
test('Carola styles are isolated, keep text untruncated and provide keyboard/touch/reduced-motion parity',()=>{
 const css=read('src/components/portal/accommodation-card.module.css');
 assert.match(css,/aspect-ratio: 35 \/ 32/);assert.match(css,/object-fit: cover/);assert.match(css,/linear-gradient\(to bottom/);
 assert.match(css,/\.card:focus-visible/);assert.match(css,/\.card:hover/);assert.match(css,/hover: none/);assert.match(css,/prefers-reduced-motion: reduce/);
 assert.match(css,/overflow-wrap: anywhere/);assert.doesNotMatch(css,/line-clamp|text-overflow: ellipsis/);
 const home=read('src/app/(energieheld)/page.tsx');assert.match(home,/styles.showcase/);assert.doesNotMatch(home,/styles.featuredStay|styles.recommendations/);
 const directory=read('src/components/portal/travel-directory.tsx');assert.match(directory,/<ListingRow/);assert.doesNotMatch(directory,/AccommodationCard/);
 const homeCss=read('src/app/(energieheld)/home.module.css');assert.doesNotMatch(homeCss,/accommodation-card-copy|accommodation-card-image/);
});

 test('shorter cards zoom only the photo, preserve focus geometry and honor reduced motion',()=>{
 const css=read('src/components/portal/accommodation-card.module.css');
 assert.match(css,/min-height: 16rem; aspect-ratio: 35 \/ 32/);assert.match(css,/\.card:hover \.photo \{ transform: scale\(1\.035\)/);
 assert.match(css,/@media \(hover: hover\) and \(pointer: fine\)/);assert.match(css,/\.card:hover \.photo \{ transform: none/);
 assert.doesNotMatch(css,/line-clamp|text-overflow|\.card:hover \{ transform/);
 const grid=read('src/app/(energieheld)/home.module.css');assert.match(grid,/repeat\(4, minmax\(0, 1fr\)\)/);
 assert.match(read('src/components/portal/profile-rotation.module.css'),/--card-height: 20.8rem/);
});
