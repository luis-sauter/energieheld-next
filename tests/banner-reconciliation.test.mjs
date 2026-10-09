import test from 'node:test'; import assert from 'node:assert/strict'; import {readFileSync,existsSync} from 'node:fs'; import './helpers/load-ts.mjs';
const {legacyBannerPages}=await import('../src/data/legacy-banner-pages.ts');
const {presentedBanners,legacyCreative}=await import('../src/lib/banner-presentation.ts');
const {sidebarCreative}=await import('../src/lib/advertising-rail.ts');
const {sidebarContentToken}=await import('../src/lib/sidebar-content.ts');
const {defaultSidebarOrder}=await import('../src/lib/sidebar-order.ts');
const {legacyBannerPreview}=await import('../src/data/legacy-banner-preview.ts');

test('A–Z restores exactly the proven former rail without Premium and preserves saved B/D/C content order',()=>{
 const path='/unterkuenfte-a-z',banners=legacyBannerPages[path];
 assert.equal(banners.length,10);
 assert.deepEqual(banners.map(({id,imageUrl,targetUrl,alt})=>({id,imageUrl,targetUrl,alt})),legacyBannerPreview.map(({id,imageUrl,targetUrl,alt})=>({id,imageUrl,targetUrl,alt})));
 const settings=defaultSidebarOrder.map((placement,i)=>({placement,size:'small',legacy_hidden:i>=10,legacy_placement:i===1?defaultSidebarOrder[3]:i===2?defaultSidebarOrder[1]:i===3?defaultSidebarOrder[2]:placement,display_source:null}));
 const result=presentedBanners([],settings,path).filter(b=>!b.suppressed);
 assert.deepEqual(result.map(b=>b.id),[banners[0].id,banners[3].id,banners[1].id,banners[2].id,...banners.slice(4).map(b=>b.id)]);
 assert.deepEqual(result.map(b=>b.placement),defaultSidebarOrder.slice(0,10));
 assert.equal(result.some(b=>b.placement==='top_banner'),false);
 const live={...result[0],id:'booked',image_path:'private',imageUrl:'signed'};
 assert.equal(presentedBanners([live],settings,path).filter(b=>b.placement===defaultSidebarOrder[0]).length,1);
 assert.equal(presentedBanners([live],settings,path)[0].id,'booked');
});

test('booking content maps independently to fixed display slots on every page, with identity fallback and unchanged metadata',()=>{
 const slots=defaultSidebarOrder, settings=slots.map((placement,i)=>({placement,size:'medium',legacy_hidden:false,display_source:i===0?slots[2]:i===2?slots[0]:placement}));
 const campaign={id:'shared-campaign',placement:slots[2],headline:'Original',target_url:'https://example.org',image_path:'private/file',imageUrl:'signed-url'};
 for(const path of ['/','/unterkuenfte-a-z','/mottoreisen/natur-pur','/reiseziele/deutschland']){
  const before=structuredClone(campaign), original=presentedBanners([campaign],[],path);
  const result=presentedBanners([campaign],settings,path);
  assert.equal(result.find(row=>row.id===campaign.id).placement,slots[0]);
  assert.equal(result.find(row=>row.id===campaign.id).imageUrl,'signed-url');assert.deepEqual(campaign,before);
  assert.equal(presentedBanners([campaign],[],path).find(row=>row.id===campaign.id).placement,slots[2]);
  assert.equal(result.find(row=>row.placement==='top_banner')?.id,original.find(row=>row.placement==='top_banner')?.id);
 }
 const invalid=settings.map(row=>({...row,display_source:slots[0]}));
 assert.equal(presentedBanners([campaign],invalid,'/').find(row=>row.id===campaign.id).placement,slots[2]);
});
test('20 audited page mappings, 143 proven creatives including restored A–Z, no global pool on unproven pages',()=>{
 assert.equal(Object.keys(legacyBannerPages).length,20);assert.equal(Object.values(legacyBannerPages).flat().length,143);
 for(const path of ['/mottoreisen','/reiseziele','/unknown']){assert.deepEqual(presentedBanners([],[],path),[]);assert.equal(sidebarCreative('sidebar_top',[]),undefined);}
 for(const [path,banners] of Object.entries(legacyBannerPages)){
  assert.equal(new Set(banners.map(b=>b.placement)).size,banners.length);
  for(const b of banners){assert.ok(existsSync(new URL('../public'+b.imageUrl,import.meta.url)));assert.match(b.targetUrl,/^https?:\/\//);assert.ok(b.width>0&&b.height>0);assert.equal(b.size,b.width===b.height?'large':'small');}
  assert.deepEqual(presentedBanners([],[],path).map(b=>b.placement),['top_banner',...defaultSidebarOrder].filter(p=>banners.some(b=>b.placement===p)));
 }
});
test('Natur uses its actual nine historical sidebar creatives and Neue Schänke top banner',()=>{
 const ads=presentedBanners([],[],'/mottoreisen/natur-pur');assert.equal(ads.length,10);
 assert.deepEqual(ads.map(x=>x.id),['legacy-367','legacy-539','legacy-360','legacy-377','legacy-379','legacy-381','legacy-385','legacy-391','legacy-412','legacy-637']);
 assert.equal(ads[1].banner_size,'large');assert.equal(ads[2].banner_size,'small');assert.ok(!ads.some(x=>x.id==='city-apart-square'));
 assert.equal(legacyCreative('sidebar_top','sidebar_top','/mottoreisen/natur-pur').id,'legacy-539');
});
test('scoped admin overrides: replacement, deletion, URL, size and moved source survive reload',()=>{
 const path='/mottoreisen/natur-pur',setting={placement:'sidebar_top',size:'medium',legacy_hidden:false,legacy_placement:'sidebar_bottom',legacy_target_url:'https://example.org/changed'};
 const moved=presentedBanners([],[setting],path).find(b=>b.placement==='sidebar_top');assert.equal(moved.id,'legacy-377');assert.equal(moved.target_url,setting.legacy_target_url);assert.equal(moved.banner_size,'medium');assert.equal(sidebarContentToken('sidebar_top',moved),'legacy:sidebar_bottom');
 const hidden={...setting,legacy_hidden:true};assert.equal(sidebarCreative('sidebar_top',presentedBanners([],[hidden],path)),undefined);
 const live={...moved,id:'current',source:'campaign',image_path:'private/path',imageUrl:'https://example.org/signed'};
 const replacement=presentedBanners([live],[hidden],path);assert.equal(replacement.filter(b=>b.placement==='sidebar_top').length,1);assert.equal(sidebarCreative('sidebar_top',replacement).id,'current');
 assert.equal(presentedBanners([],[],'/reiseziele/deutschland').find(b=>b.placement==='sidebar_top').id,'legacy-369');
});
test('banner sizes reserve common reference envelopes, lazy images retain proven dimensions and safe links',()=>{
 const source=readFileSync(new URL('../src/components/advertising/campaign-view.tsx',import.meta.url),'utf8');const css=readFileSync(new URL('../src/components/advertising/advertising.module.css',import.meta.url),'utf8');
 assert.match(source,/width=\{width\} height=\{height\} loading="lazy" decoding="async"/);assert.doesNotMatch(source,/onLoad=|width=\{1200\}|height=\{600\}/);
 assert.match(css,/data-size="large".*aspect-ratio: 1/);assert.match(css,/data-size="small".*350 \/ 120/);assert.match(css,/data-size="medium".*350 \/ 235/);assert.match(css,/data-size\] img.*object-fit: contain/);
 assert.match(source,/rel="sponsored noopener noreferrer"/);assert.match(source,/target="_blank"/);
});

test('mobile Premium art direction uses actual verified dimensions without another slot or request per banner',()=>{
 const banners=Object.values(legacyBannerPages).flat().filter(b=>b.mobile);assert.equal(banners.length,15);
 for(const b of banners){assert.equal(b.placement,'top_banner');assert.ok(b.mobile.width>0&&b.mobile.height>0);assert.ok(existsSync(new URL('../public'+b.mobile.imageUrl,import.meta.url)));}
 const source=readFileSync(new URL('../src/components/advertising/campaign-view.tsx',import.meta.url),'utf8');assert.match(source,/<source media="\(max-width: 760px\)" srcSet=\{mobile.imageUrl\}/);assert.match(source,/width=\{mobile.width\} height=\{mobile.height\}/);
 const rotationCss=readFileSync(new URL('../src/components/portal/profile-rotation.module.css',import.meta.url),'utf8');assert.match(rotationCss,/--rows: 3/);assert.match(rotationCss,/repeat\(2, minmax\(0, 1fr\)\)/);assert.match(rotationCss,/max-width: 700px.*--rows: 6.*grid-template-columns: 1fr/);
});

test('homepage Premium retains its fixed identity exactly once, after themes and before destinations',()=>{
 const home=readFileSync(new URL('../src/app/(energieheld)/page.tsx',import.meta.url),'utf8');
 assert.equal(home.match(/placements=\{\["top_banner"\]\}/g).length,1);
 assert.ok(home.indexOf('placements={["top_banner"]}')>home.indexOf('aria-labelledby="inspiration-title"'));
 assert.ok(home.indexOf('placements={["top_banner"]}')<home.indexOf('aria-labelledby="destinations-title"'));
});
