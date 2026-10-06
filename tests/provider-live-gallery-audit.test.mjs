import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const live=read('docs/reiseportal-live-gallery-audit.json');
const cards=read('src/data/reiseportal-travel-provider-images.json');
const galleries=read('src/data/reiseportal-legacy-provider-media.json');
const initial=read('docs/reiseportal-provider-image-audit.json');
const assets=read('docs/reiseportal-legacy-az-assets.json');
test('all 58 real providers and all 29 previously open cases have actual old live-page evidence',()=>{
 assert.equal(live.providers.length,58);assert.equal(new Set(live.providers.map(p=>p.slug)).size,58);
 for(const p of live.providers){
  assert.equal(p.live_page_checked,'yes');assert.ok(p.old_pages.length,p.slug);
  assert.ok(p.old_pages.some(s=>s.joomla_id===p.joomla_article_id),p.slug);
  for(const s of p.old_pages){assert.equal(new URL(s.index_url).hostname,'das-reiseportal.com');assert.match(s.html_sha256,/^[a-f0-9]{64}$/);}
 }
 const open=live.providers.filter(p=>['IMPORT_CONFIRMED','NO_IMAGE_FOUND_CONFIRMED','AMBIGUOUS_SKIP'].includes(p.result));
 assert.equal(open.length,29);assert.equal(open.filter(p=>p.result==='IMPORT_CONFIRMED').length,1);
 assert.equal(open.filter(p=>p.result==='NO_IMAGE_FOUND_CONFIRMED').length,26);
 assert.equal(open.filter(p=>p.result==='AMBIGUOUS_SKIP').length,2);
});
test('full old photo sequences have exact provider/SHA provenance and complete central resolution',()=>{
 let photos=0,missing=0,local=0,cloud=0;
 for(const p of live.providers){
  assert.equal(new Set(p.photos.map(i=>i.sha256)).size,p.photos.length,p.slug);
  assert.equal(p.photos.length,p.old_distinct_suitable_photo_count);photos+=p.photos.length;missing+=p.missing_identified_count;
  for(const image of p.photos){
   const source=assets.find(a=>a.profile_slug===p.slug&&a.sha256===image.sha256&&a.source_url===image.source_url&&a.decision==='ASSIGN');
   assert.ok(source,p.slug);assert.equal(source.public_asset,image.local_asset);
   assert.equal(createHash('sha256').update(readFileSync(new URL('../public'+image.local_asset,import.meta.url))).digest('hex'),image.sha256);
   if(image.resolution==='existing_central_profile_gallery_reference'){
    assert.ok(galleries[p.slug].images.some(i=>i.src===image.local_asset),p.slug);local++;
   }else if(image.resolution==='existing_admin_media_upload'){
    assert.match(image.storage_path,/^profiles\/[a-f0-9-]{36}\/gallery\/[a-f0-9-]{36}\.jpg$/);
    assert.ok(p.cloud_gallery_paths_after.some(i=>i.path===image.storage_path));cloud++;
   }
  }
  assert.equal(p.missing_after_count,0);
 }
 assert.equal(photos,238);assert.equal(missing,16);assert.equal(local,14);assert.equal(cloud,2);
});
test('original 29 card selections stay intact and Jägeralpe uses its own new central photo',()=>{
 for(const p of initial.providers.filter(p=>p.legacy_photo)){
  const original=Object.fromEntries(Object.entries(p.legacy_photo).filter(([key])=>!['source_url','source_field','sha256'].includes(key)));
  assert.deepEqual(cards[p.slug],original,p.slug);
 }
 const p=live.providers.find(p=>p.slug==='jaegeralpe');
 assert.equal(p.cloud_gallery_before_count,0);assert.equal(p.cloud_gallery_after_count,1);
 assert.ok(p.photos.some(i=>i.local_asset===cards.jaegeralpe.src&&i.resolution==='existing_admin_media_upload'));
});
test('new uploads append rather than replace existing Sonnenhof media; unsuitable sources stay excluded',()=>{
 const p=live.providers.find(p=>p.slug==='pension-sonnenhof');
 assert.equal(p.cloud_gallery_before_count,5);assert.equal(p.cloud_gallery_after_count,6);
 assert.deepEqual(p.cloud_gallery_paths_after.slice(0,5),p.cloud_gallery_paths_before);
 for(const slug of ['sub-aqua-tauchreisen','wirodive-tauchreisen']){
  const row=live.providers.find(p=>p.slug===slug);assert.equal(row.result,'AMBIGUOUS_SKIP');assert.equal(row.photos.length,0);assert.equal(cards[slug],undefined);
 }
 assert.ok(live.providers.find(p=>p.slug==='kemmeriboden-bad').skipped_sources.some(i=>i.reason==='SKIP_FOREIGN_PROVIDER'));
 assert.equal(live.cloud_verification.migration,null);
 assert.equal(live.cloud_verification.content_hash_before,live.cloud_verification.content_hash_after);
 assert.equal(live.cloud_verification.taxonomy_hash_before,live.cloud_verification.taxonomy_hash_after);
});
