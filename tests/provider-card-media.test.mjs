import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import './helpers/load-ts.mjs';
registerHooks({resolve(s,c,next){
  if(s.startsWith('@/')) return next(new URL('../src/'+s.slice(2)+(s.endsWith('.json')?'':'.ts'),import.meta.url).href,c);
  return next(s,c);
}});
const {providerCardImage,providerTravelImage: selectTravelPhoto}=await import('../src/lib/provider-card-media.ts');
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const audit=json('docs/reiseportal-provider-image-audit.json');
const photos=json('src/data/reiseportal-travel-provider-images.json');
const providerTravelImage=listing=>selectTravelPhoto(listing,photos[listing.slug]);
const assets=json('docs/reiseportal-legacy-az-assets.json');
const photo={src:'https://example.test/signed/gallery.jpg',alt:'Saved provider photo'};
const logo={src:'https://example.test/signed/logo.png',alt:'Logo'};
const listing={slug:'wellnesshotel-almhof-call',directoryPackage:'basic',images:[photo],logo,directoryImage:photo};

test('Basic directory presentation ignores profile/gallery/logo photos; travel cards retain them',()=>{
 assert.equal(providerCardImage(listing,'directory'),undefined);
 assert.equal(providerCardImage({...listing,travelImage:providerTravelImage(listing)},'travel'),photo);
 assert.equal(providerCardImage({...listing,directoryPackage:'premium'},'directory'),photo);
});
test('destination and motto reuse the same central saved photo without changing input',()=>{
 const before=structuredClone(listing);const selected=providerTravelImage(listing);
 const hydrated={...listing,travelImage:selected};
 assert.equal(providerCardImage(hydrated,'travel'),selected);
 assert.equal(providerCardImage(hydrated,'travel'),selected);
 assert.deepEqual(listing,before);
});
test('curated Legacy photo replaces unsuitable first graphic for travel only; saved gallery wins',()=>{
 const row={...listing,slug:'appartementhaus-salzburg',images:[],directoryPackage:'premium'};
 const selected=providerTravelImage(row);
 assert.equal(selected.src,'/reiseportal/legacy-provider-media/appartementhaus-salzburg/04.jpg');
 assert.equal(providerCardImage({...row,travelImage:selected},'directory'),photo);
 assert.equal(providerTravelImage({...row,images:[photo]}),photo);
});
test('missing and logo-only media keep honest travel fallback; promotional assets are excluded',()=>{
 for(const slug of ['alpenhotel-montafon','sub-aqua-tauchreisen','wirodive-tauchreisen']){
  const row={...listing,slug,images:[],logo};assert.equal(providerTravelImage(row),null);
  assert.equal(providerCardImage({...row,images:[logo],travelImage:null},'travel'),undefined);
 }
 assert.equal(providerTravelImage({...listing,slug:'no-photo',images:[logo]}),null);
});
test('all selected originals have exact provider/article/hash evidence; no duplicate copies per page',()=>{
 assert.equal(Object.keys(photos).length,30);assert.equal(new Set(Object.values(photos).map(p=>p.src)).size,30);
 for(const [slug,image]of Object.entries(photos)){
  const bytes=readFileSync(new URL('../public'+image.src,import.meta.url));
  const hash=createHash('sha256').update(bytes).digest('hex');
  const evidence=assets.find(a=>a.profile_slug===slug&&a.sha256===hash&&a.decision==='ASSIGN');
  assert.ok(evidence,slug);assert.ok(['article-html','contact-person-image-bd','content-image-1-bd','content-image-2-bd','image_intro'].includes(evidence.field));
 }
 assert.equal(audit.providers.length,58);assert.equal(new Set(audit.providers.map(p=>p.profile_id)).size,58);
 assert.deepEqual(audit.summary,{audited:58,destinations:58,themes:58,existing_ok:29,import_confirmed:1,no_image_found:26,ambiguous_skip:2,new_storage_objects:2,new_media_rows:2,reused_provider_photos:30});
});
test('Sonnenhof saved gallery is reused; no profile text, gallery, package or review change',()=>{
 const row={...listing,slug:'pension-sonnenhof',images:[photo],review:'unverified'};const before=structuredClone(row);
 assert.equal(providerTravelImage(row),photo);assert.deepEqual(row,before);
 const excluded=photos['pension-sonnenhof'].excludedSavedPaths.map(path=>({src:'https://example.test/storage/v1/object/sign/company-media/'+path+'?token=test',alt:'Unsuitable saved graphic'}));
 assert.equal(providerTravelImage({...row,images:[excluded[0],photo,excluded[1]]}),photo);
 assert.equal(providerTravelImage({...row,images:excluded}).src,photos['pension-sonnenhof'].src);
 const fallback=providerTravelImage({...row,images:[]});assert.match(fallback.src,/pension-sonnenhof\/01.jpg$/);
 assert.notEqual(fallback.src,photos['pension-sonnenhof'].logo);
});
