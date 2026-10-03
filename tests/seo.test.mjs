import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

registerHooks({
 resolve(s,c,next) {
  if(s==='server-only')return {url:'data:text/javascript,export {}',shortCircuit:true};
  if(s.endsWith('.module.css'))return {url:'data:text/javascript,export default {}',shortCircuit:true};
  if(s==='next/link')return {url:'data:text/javascript,export default "a"',shortCircuit:true};
  if(s==='next/navigation')return {url:'data:text/javascript,export function notFound(){throw Error("NOT_FOUND")};export function permanentRedirect(path){throw Error("REDIRECT:"+path)}',shortCircuit:true};
  if(s==='@/components/portal/discovery-detail')return {url:'data:text/javascript,export function DiscoveryDetail(){return null}',shortCircuit:true};
  if(s==='@/lib/discovery-advertising')return {url:'data:text/javascript,export async function loadDiscoveryAdvertising(){return {}}',shortCircuit:true};
  if(s==='@/lib/portal-search')return {url:'data:text/javascript,export async function searchPortal(){throw Error("Not used by metadata")}',shortCircuit:true};
  if(s.startsWith('@/')||s.startsWith('.')) {
   const base=s.startsWith('@/')?new URL('../src/'+s.slice(2),import.meta.url):new URL(s,c.parentURL);
   for(const ext of ['.ts','.tsx'])if(existsSync(new URL(base.href+ext)))return next(base.href+ext,c);
  }
  return next(s,c);
 },
 load(url,c,next) {if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ModuleKind.ESNext,jsx:JsxEmit.ReactJSX}}).outputText};return next(url,c);}
});

const {siteSeo,siteUrl,robotsHeader}=await import('../src/lib/site-seo.ts');
const {pageMetadata,rootMetadata,discoveryMetadata,directoryMetadata,profileMetadata,sitemapEntries,robotsRules,plainSeoText,seoExcerpt}=await import('../src/lib/seo.ts');
const {profileSchema,websiteSchema,breadcrumbSchema,collectionSchema,jsonLdGraph,serializeJsonLd}=await import('../src/lib/seo-schema.ts');
const {destinations,travelThemes}=await import('../src/data/reiseportal-discovery.ts');
const {portalBreadcrumbs}=await import('../src/lib/breadcrumbs.ts');
const {Breadcrumbs}=await import('../src/components/portal/breadcrumbs.tsx');
const {JsonLd}=await import('../src/components/portal/json-ld.tsx');
const {relatedTravelPages}=await import('../src/lib/travel-relations.ts');
const {TravelRelations}=await import('../src/components/portal/travel-relations.tsx');
const {loadPublicCompanyProfileIndex}=await import('../src/lib/public-companies.ts');
const {loadReiseportalProfileIndex}=await import('../src/lib/reiseportal-directory.ts');
const production=siteSeo({SITE_URL:'https://portal.example',SITE_INDEXING:'enabled',NODE_ENV:'production',CONTEXT:'production'});
const listing={id:'real-1',slug:'sonnenhof',name:'Pension Sonnenhof',tagline:'Urlaub in Meransen.',description:'<p>Ein echter Profiltext.</p>',location:{street:'Dorfstraße 1',city:'Meransen',postalCode:'39037',region:'Südtirol',country:'Italien'},categoryIds:[],contact:{phone:'+39 123',email:'info@example.com',website:'https://provider.example'},images:[{src:'/reiseportal/hero.jpg',alt:'Originalbild'}],services:[],isDemo:false,travelTermKeys:['theme:wellnessangebote','accommodation:pension','audience:familie']};
const terms=[{term_key:'theme:wellnessangebote',dimension:'theme',slug:'wellnessangebote',label:'Wellnessangebote'},{term_key:'accommodation:pension',dimension:'accommodation',slug:'pension',label:'Pension'},{term_key:'audience:familie',dimension:'audience',slug:'familie',label:'Familie'},{term_key:'feature:pool',dimension:'feature',slug:'pool',label:'Pool'},{term_key:'accommodation:hotel',dimension:'accommodation',slug:'hotel',label:'Hotel'}];

test('production identity is explicit and portable; missing/invalid/preview origins fail closed',()=>{
 assert.equal(production.indexable,true);
 for(const env of [{},{SITE_URL:'https://portal.example',NODE_ENV:'production'},{SITE_URL:'https://portal.example',SITE_INDEXING:'enabled',NODE_ENV:'development'},{SITE_URL:'https://portal.example',SITE_INDEXING:'enabled',NODE_ENV:'production',CONTEXT:'branch-deploy'},{SITE_URL:'https://portal.example',SITE_INDEXING:'enabled',NODE_ENV:'production',CONTEXT:'deploy-preview'},{SITE_URL:'https://portal.example',SITE_INDEXING:'enabled',NODE_ENV:'production',SITE_ENVIRONMENT:'preview'},{SITE_URL:'https://portal.example',SITE_INDEXING:'enabled',NODE_ENV:'production',VERCEL_ENV:'preview'}])assert.equal(siteSeo(env).indexable,false);
 for(const url of ['http://portal.example','https://u:p@portal.example','https://portal.example/path','https://portal.example?q=1','https://localhost','https://abc--project.netlify.app'])assert.equal(siteSeo({SITE_URL:url}).canonicalOrigin,undefined);
 assert.equal(siteUrl('/reiseziele?x=1#foo',production),'https://portal.example/reiseziele');
 assert.equal(siteUrl('//foreign.example',production),undefined);
 assert.equal(siteUrl('/\\foreign.example',production),undefined);
});

test('metadata provides title/description/OG/Twitter and canonical without preview-domain fallbacks',()=>{
 const home=pageMetadata({title:production.defaultTitle,description:production.defaultDescription,path:'/',home:true},production);
 assert.deepEqual(home.title,{absolute:production.defaultTitle});assert.equal(home.robots.index,true);
 assert.equal(home.alternates.canonical,'https://portal.example/');assert.equal(home.openGraph.locale,'de_DE');
 assert.ok(home.openGraph.images[0].url.startsWith('https://portal.example/'));assert.equal(home.twitter.card,'summary_large_image');
 assert.equal(rootMetadata(production).title.template,'%s | DAS Reiseportal');assert.equal(rootMetadata(production).robots.index,false);
 const preview=pageMetadata({title:'Reiseziele',description:'Echte Ziele',path:'/reiseziele'},siteSeo({CONTEXT:'branch-deploy'}));
 assert.equal(preview.robots.index,false);assert.equal(preview.robots.follow,true);assert.equal(preview.alternates,undefined);assert.equal(preview.openGraph.url,undefined);assert.equal(preview.openGraph.images,undefined);
});

test('four destination and twelve topic metadata descriptions are unique, real and bounded',()=>{
 const descriptions=[];
 for(const [entries,kind,path]of [[destinations,'destination','reiseziele'],[travelThemes,'theme','mottoreisen']])for(const entry of entries){
  const meta=discoveryMetadata(entry,kind,production);assert.ok(meta.title.includes(entry.title));assert.ok(meta.description.length>30&&meta.description.length<=170);assert.equal(meta.alternates.canonical,`https://portal.example/${path}/${entry.slug}`);assert.equal(meta.robots.index,true);descriptions.push(meta.description);
 }
 assert.equal(new Set(descriptions).size,16);
});

test('A-Z queries are noindex/follow; single known theme/destination canonicalizes to stable landing page',()=>{
 const base=directoryMetadata({},production);assert.equal(base.robots.index,true);assert.equal(base.alternates.canonical,'https://portal.example/unterkuenfte-a-z');
 for(const key of ['thema','ziel','zielgruppe','unterkunftstyp','besonderheit','ort','sort','q']){
  const meta=directoryMetadata({[key]:'value'},production);assert.deepEqual(meta.robots,{index:false,follow:true});assert.equal(meta.alternates.canonical,base.alternates.canonical);
 }
 assert.equal(directoryMetadata({thema:'wellnessangebote'},production).alternates.canonical,'https://portal.example/mottoreisen/wellnessangebote');
 assert.equal(directoryMetadata({ziel:'oesterreich'},production).alternates.canonical,'https://portal.example/reiseziele/oesterreich');
 assert.equal(directoryMetadata({ziel:'oesterreich',thema:'wellnessangebote'},production).alternates.canonical,base.alternates.canonical);
 assert.equal(directoryMetadata({thema:['wellnessangebote','natur-pur']},production).alternates.canonical,base.alternates.canonical);
 const search=pageMetadata({title:'Suchergebnisse',description:'Öffentliche Inhalte',noindex:true},production);assert.equal(search.robots.index,false);assert.equal(search.alternates,undefined);
});

test('real profile metadata uses actual location and normalized sentence excerpt; demos stay noindex',()=>{
 const meta=profileMetadata(listing,production);assert.equal(meta.title,'Pension Sonnenhof in Meransen');assert.equal(meta.alternates.canonical,'https://portal.example/unterkuenfte/sonnenhof');assert.match(meta.description,/Pension Sonnenhof in Meransen\. Urlaub in Meransen\./);
 assert.equal(plainSeoText('<script>bad()</script><p>A &amp; B &#246;</p>'),'A & B ö');
 assert.ok(seoExcerpt('Lange Wörter '.repeat(40)).length<=170);
 const missing=profileMetadata({...listing,tagline:'',description:'',location:{city:'',region:'',country:'',postalCode:''}},production);assert.equal(missing.title,'Pension Sonnenhof');assert.ok(missing.description.length>20);assert.doesNotMatch(missing.description,/undefined|null/);
 for(const altered of [{isDemo:true},{isPreview:true},{slug:'demo-gmbh'},{id:'31ae7d1e-26a7-4161-8d14-f5ee4735f5d4'}]){const meta=profileMetadata({...listing,...altered},production);assert.equal(meta.robots.index,false);assert.equal(meta.alternates,undefined);}
});

test('sitemap contains only real stable pages and approved eligible profiles, no invented dates',()=>{
 const entries=sitemapEntries([listing,listing,{...listing,slug:'demo-gmbh'},{...listing,isPreview:true}],production);
 assert.equal(entries.length,23);assert.ok(entries.some(e=>e.url.endsWith('/unterkuenfte/sonnenhof')));
 assert.ok(entries.every(e=>Object.keys(e).join()==='url'));assert.ok(entries.every(e=>!/[?]|\/suche|\/admin|\/firma|\/login|demo/.test(e.url)));
 assert.deepEqual(sitemapEntries([listing],siteSeo({})),[]);
 assert.deepEqual(sitemapEntries([listing],siteSeo({SITE_URL:'https://portal.example',SITE_INDEXING:'enabled',NODE_ENV:'production',CONTEXT:'branch-deploy'})),[]);
});

test('robots supports crawlable noindex previews without publishing their sitemap; private/header rules survive production',()=>{
 assert.equal(robotsRules(production).sitemap,'https://portal.example/sitemap.xml');
 assert.equal(robotsRules(siteSeo({})).sitemap,undefined);assert.equal(robotsRules(siteSeo({})).rules.allow,'/');
 assert.equal(robotsHeader('/',siteSeo({})),'noindex, follow');assert.equal(robotsHeader('/',production),undefined);
 for(const path of ['/admin','/admin/werbung','/firma/profil','/login','/registrieren','/auth/confirm','/api/private','/unterkuenfte/demo-gmbh'])assert.equal(robotsHeader(path,production),'noindex, nofollow');
});

test('breadcrumb UI and JSON-LD share hierarchy, current page and absolute URLs; unknown origin omits incomplete schema',()=>{
 const items=portalBreadcrumbs('Pension Sonnenhof','/unterkuenfte/sonnenhof',{name:'Unterkünfte A–Z',path:'/unterkuenfte-a-z'});
 const html=renderToStaticMarkup(createElement(Breadcrumbs,{items}));assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.equal((html.match(/aria-hidden="true"/g)||[]).length,2);assert.ok(html.includes('href="/unterkuenfte-a-z"'));assert.ok(!html.includes('href="/unterkuenfte/sonnenhof"'));
 const schema=breadcrumbSchema(items,production);assert.deepEqual(schema.itemListElement.map(i=>i.name),items.map(i=>i.name));assert.deepEqual(schema.itemListElement.map(i=>i.position),[1,2,3]);assert.equal(schema.itemListElement[2].item,'https://portal.example/unterkuenfte/sonnenhof');assert.equal(breadcrumbSchema(items,siteSeo({})),null);
});

test('provider schema type is based only on assigned accommodation terms and includes no fabricated properties',()=>{
 const graph=jsonLdGraph(profileSchema(listing,terms,production));const entity=graph['@graph'][0];assert.equal(entity['@type'],'LodgingBusiness');assert.equal(entity.address.addressLocality,'Meransen');assert.equal(entity.sameAs,'https://provider.example/');
 assert.deepEqual(entity.knowsAbout.map(t=>t.termCode),listing.travelTermKeys);assert.ok(!JSON.stringify(graph).includes('feature:pool'));
 for(const key of ['starRating','aggregateRating','review','reviewCount','priceRange','amenityFeature','geo'])assert.equal(entity[key],undefined);
 assert.equal(profileSchema({...listing,travelTermKeys:['accommodation:hotel']},terms,production)[0]['@type'],'Hotel');
 assert.equal(profileSchema({...listing,travelTermKeys:['theme:wellnessangebote']},terms,production)[0]['@type'],'Organization');
 assert.deepEqual(profileSchema({...listing,isDemo:true},terms,production),[]);
 const empty=jsonLdGraph(profileSchema({...listing,images:[],contact:{phone:'',email:'',website:'javascript:alert(1)'},location:{city:'',country:'',postalCode:'',region:''}},[],production))['@graph'][0];
 assert.equal(empty.image,undefined);assert.equal(empty.telephone,undefined);assert.equal(empty.address,undefined);assert.equal(empty.sameAs,undefined);
 const signed=jsonLdGraph(profileSchema({...listing,images:[{src:'https://private.example/image?token=x',alt:'Bild'}]},terms,production));assert.ok(!JSON.stringify(signed).includes('token='));
});

test('Website/Organization and CollectionPage describe real visible information, without fake FAQ or SearchAction',()=>{
 const site=jsonLdGraph(websiteSchema(production));assert.deepEqual(site['@graph'].map(n=>n['@type']),['Organization','WebSite']);assert.ok(!JSON.stringify(site).includes('SearchAction'));
 const collection=collectionSchema({name:'Österreich',description:'Unterkünfte im Portal',path:'/reiseziele/oesterreich',items:[{name:listing.name,path:'/unterkuenfte/sonnenhof'}]},production);assert.equal(collection['@type'],'CollectionPage');assert.equal(collection.mainEntity.numberOfItems,1);assert.equal(collection.mainEntity.itemListElement[0].item.url,'https://portal.example/unterkuenfte/sonnenhof');assert.ok(!JSON.stringify(collection).includes('FAQPage'));
});

test('JSON-LD escapes script termination, HTML, ampersands and Unicode separators and remains valid JSON',()=>{
 const attack='</script><script>alert(1)</script>&\u2028\u2029';const data=jsonLdGraph([{'@type':'Organization',name:attack}]);const serialized=serializeJsonLd(data);
 assert.ok(!serialized.includes('<')&&!serialized.includes('&')&&!serialized.includes('\u2028')&&!serialized.includes('\u2029'));assert.equal(JSON.parse(serialized)['@graph'][0].name,attack);
 const html=renderToStaticMarkup(createElement(JsonLd,{data}));assert.equal((html.match(/<script/g)||[]).length,1);assert.equal((html.match(/<\/script>/g)||[]).length,1);assert.equal(renderToStaticMarkup(createElement(JsonLd,{data:null})), '');
});

test('visible relationships use real taxonomy/country data, never infer from descriptive text',()=>{
 const relation=relatedTravelPages([listing]);assert.deepEqual(relation.destinations.map(r=>r.name),['Südtirol/Italien']);assert.deepEqual(relation.themes.map(r=>r.name),['Wellnessangebote']);
 assert.deepEqual(relatedTravelPages([{...listing,travelTermKeys:[],tagline:'Golf Pool Wellness Wandern'}]).themes,[]);
 const html=renderToStaticMarkup(createElement(TravelRelations,{title:'Reiseinformationen',links:[...relation.destinations,...relation.themes],facts:terms.filter(t=>listing.travelTermKeys.includes(t.term_key))}));assert.ok(html.includes('Unterkunftstyp'));assert.ok(html.includes('Pension'));assert.ok(html.includes('href="/mottoreisen/wellnessangebote"'));assert.ok(!html.includes('Pool'));
});

test('unknown destination/topic slugs are 404 in metadata and page rendering',async()=>{
 for(const path of ['reiseziele','mottoreisen']){
  const route=await import(`../src/app/(energieheld)/${path}/[slug]/page.tsx`);
  await assert.rejects(route.generateMetadata({params:Promise.resolve({slug:'unknown'})}),/NOT_FOUND/);
  await assert.rejects(route.default({params:Promise.resolve({slug:'unknown'})}),/NOT_FOUND/);
 }
});

test('search route metadata stays noindex/follow with the shared helper and no canonical',async()=>{
 const {metadata}=await import('../src/app/(energieheld)/suche/page.tsx');
 assert.equal(metadata.robots.index,false);assert.equal(metadata.robots.follow,true);
 assert.equal(metadata.alternates,undefined);assert.equal(metadata.title,'Suchergebnisse');
});

test('sitemap public source paginates approved rows, excludes demo/energy and never signs media or authenticates',async()=>{
 const previousFetch=globalThis.fetch;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://public-test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
 const row=i=>({id:`real-${i}`,slug:`provider-${i}`,status:'approved',display_name:`Provider ${i}`,tagline:null,description:null,business_areas:null,company_profile_categories:[]});
 const requests=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(typeof input==='string'?input:input.url);requests.push(url);assert.ok(url.includes('/rest/v1/company_profiles'));assert.ok(url.includes('status=eq.approved'));assert.ok(!/logo_path|company_profile_images|owner_user_id|storage/.test(url));
  const headers=new Headers(init?.headers??input.headers);const start=headers.get('Range')?.split('-')[0]??new URL(url).searchParams.get('offset')??'0';
  const data=start==='0'?Array.from({length:500},(_,i)=>row(i)):[row(500),{...row(501),slug:'energieheld-demo-gmbh-c3351d59'},{...row(502),display_name:'Energieberatung'},{...row(503),status:'draft'}];
  return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
 };
 try{
  assert.equal((await loadPublicCompanyProfileIndex()).length,503);
  requests.length=0;const index=await loadReiseportalProfileIndex();assert.equal(index.length,501);assert.equal(requests.length,2);assert.ok(!index.some(p=>p.slug.includes('demo')));
 }finally{globalThis.fetch=previousFetch;}
});

test('page integration retains safe 404/redirect and shares the profile loader between metadata and rendering',()=>{
 const source=readFileSync(new URL('../src/app/(energieheld)/unterkuenfte/[slug]/page.tsx',import.meta.url),'utf8');
 assert.equal((source.match(/await loadAccommodationPage\(slug\)/g)||[]).length,2);assert.match(source,/if \(!result.data\) notFound\(\)/);assert.match(source,/permanentRedirect\("\/unterkuenfte\/hoeflehner"\)/);
 const loader=readFileSync(new URL('../src/lib/accommodation-page.ts',import.meta.url),'utf8');assert.match(loader,/cache\(async/);assert.equal((loader.match(/loadPublicProfileTravelTerms\(result.data.id\)/g)||[]).length,1);
});
