import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMediaTestDatabase } from './helpers/media-database.mjs';
const admin='33333333-3333-4333-8333-333333333333', owner='11111111-1111-4111-8111-111111111111', stranger='22222222-2222-4222-8222-222222222222';
const editor='44444444-4444-4444-8444-444444444444';
const profile='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', draft='dddddddd-dddd-4ddd-8ddd-dddddddddddd', block='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', image='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let db;
before(async()=>{
 db=await createMediaTestDatabase(true);
 await db.exec(`alter table storage.objects add column metadata jsonb;
  alter table company_profiles add column updated_at timestamptz default now();
  create policy profiles_admin_update on company_profiles for update to authenticated using(exists(select 1 from portal_admins where user_id=auth.uid()));`);
 for(const file of ['20260924155258_admin_company_media_editor.sql','20260924171344_profile_content_blocks.sql',
  '20260924202803_profile_image_grid_blocks.sql','20260924210916_profile_image_grid_resizing.sql',
  '20260924214027_universal_content_block_layout.sql','20260924220748_image_crop_focus_zoom.sql',
  '20260925083617_profile_block_image_captions.sql','20260929120000_share_profile_block_images.sql',
  '20260926160000_reiseportal_travel_taxonomy.sql','20261004100000_company_profile_video.sql'])
  await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 // Match the existing live content column grants omitted by the minimal media fixture.
 await db.exec(`alter table company_profiles add column if not exists street text;
  grant update(tagline,description,phone,public_email,website,street,postal_code,city,region,country) on company_profiles to authenticated;`);
 await db.query('insert into portal_admins values($1)',[admin]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
 await db.query("insert into companies values($1,$1,'Company')",[owner]);
 for(const id of [profile,draft]){
  await db.query("insert into company_profiles(id,company_id,display_name,status,description) values($1,$2,'Profile','draft','Original')",[id,owner]);
  await db.query("insert into company_profile_categories(profile_id,category_id) values($1,'heizung')",[id]);
 }
 await db.query("update company_profiles set status='approved' where id=$1",[profile]);
 await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values($1,$2,'image_grid','{}','{\"columns\":1,\"width_percent\":100,\"offset_percent\":0,\"aspect_ratio\":1.5,\"spacing_top\":\"normal\",\"spacing_bottom\":\"normal\"}')",[block,profile]);
 await db.query('insert into profile_content_block_images(id,block_id,storage_path) values($1,$2,$3)',[image,block,`profiles/${profile}/blocks/${block}/66666666-6666-4666-8666-666666666666.jpg`]);
 const dataBefore=(await db.query('select to_jsonb(p) v from company_profiles p order by id')).rows;
 const policiesBefore=(await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows;
 await db.exec(await readFile(new URL('../supabase/migrations/20261004160000_profile_content_freshness.sql',import.meta.url),'utf8'));
 const rpcGrants=(await db.query("select proacl from pg_proc where oid='public.review_profile_content(uuid,bigint)'::regprocedure")).rows;
 const stateBefore=(await db.query('select * from profile_content_freshness order by profile_id')).rows;
 await db.exec(await readFile(new URL('../supabase/migrations/20261004163000_profile_review_conflict.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query("select proacl from pg_proc where oid='public.review_profile_content(uuid,bigint)'::regprocedure")).rows,rpcGrants);
 assert.deepEqual((await db.query('select * from profile_content_freshness order by profile_id')).rows,stateBefore);
 await db.exec(await readFile(new URL('../supabase/migrations/20261004190000_profile_review_invalidation.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query("select proacl from pg_proc where oid='public.review_profile_content(uuid,bigint)'::regprocedure")).rows,rpcGrants);
 assert.deepEqual((await db.query("select to_jsonb(f)-'review_invalidated_at'-'review_invalidated_by' as v from profile_content_freshness f order by profile_id")).rows.map(x=>x.v),stateBefore);
 assert.deepEqual((await db.query('select to_jsonb(p) v from company_profiles p order by id')).rows,dataBefore);
 assert.deepEqual((await db.query("select * from pg_policies where tablename<>'profile_content_freshness' order by schemaname,tablename,policyname")).rows,policiesBefore);
 const allPolicies=(await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows;
 const beforeCapability=(await db.query('select * from profile_content_freshness order by profile_id')).rows;
 const withdrawAcl=(await db.query("select proacl from pg_proc where oid='public.invalidate_profile_review(uuid,bigint,timestamptz)'::regprocedure")).rows;
 await db.exec(await readFile(new URL('../supabase/migrations/20261005090000_profile_review_capability.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query('select * from profile_content_freshness order by profile_id')).rows,beforeCapability);
 assert.deepEqual((await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows,allPolicies);
 assert.deepEqual((await db.query('select to_jsonb(p) v from company_profiles p order by id')).rows,dataBefore);
 assert.deepEqual((await db.query("select proacl from pg_proc where oid='public.review_profile_content(uuid,bigint)'::regprocedure")).rows,rpcGrants);
 assert.deepEqual((await db.query("select proacl from pg_proc where oid='public.invalidate_profile_review(uuid,bigint,timestamptz)'::regprocedure")).rows,withdrawAcl);
 assert.equal((await db.query('select can_review_profiles from portal_admins where user_id=$1',[admin])).rows[0].can_review_profiles,false);
 // Explicit local fixture configuration only; no production identity seed.
 await db.query('update portal_admins set can_review_profiles=true where user_id=$1',[admin]);
 await db.query('insert into portal_admins(user_id) values($1)',[editor]);
 const oldBuckets=(await db.query('select * from storage.buckets order by id')).rows;
 const oldFreshness=(await db.query('select * from profile_content_freshness order by profile_id')).rows;
 const trackerAcl=(await db.query("select proacl from pg_proc where oid='private.track_profile_content()'::regprocedure")).rows;
 const oldProfiles=(await db.query('select to_jsonb(p) v from company_profiles p order by id')).rows;
 const oldStorage=(await db.query('select to_jsonb(o) v from storage.objects o order by id')).rows;
 const oldPolicies=(await db.query('select * from pg_policies order by schemaname,tablename,policyname')).rows;
 await db.exec(await readFile(new URL('../supabase/migrations/20261005120000_profile_contact_person.sql',import.meta.url),'utf8'));
 assert.deepEqual((await db.query("select to_jsonb(p)-'contact_first_name'-'contact_last_name'-'contact_image_path' as v from company_profiles p order by id")).rows,oldProfiles);
 assert.deepEqual((await db.query('select to_jsonb(o) v from storage.objects o order by id')).rows,oldStorage);
 assert.deepEqual((await db.query('select * from storage.buckets order by id')).rows,oldBuckets);
 assert.deepEqual((await db.query('select * from profile_content_freshness order by profile_id')).rows,oldFreshness);
 assert.deepEqual((await db.query("select proacl from pg_proc where oid='private.track_profile_content()'::regprocedure")).rows,trackerAcl);
 assert.deepEqual((await db.query("select * from pg_policies where policyname not like 'company_contact_image_%' order by schemaname,tablename,policyname")).rows,oldPolicies);
 assert.deepEqual((await db.query("select proacl from pg_proc where oid='public.review_profile_content(uuid,bigint)'::regprocedure")).rows,rpcGrants);
});
after(async()=>db?.close());
beforeEach(async()=>db.exec('begin'));
afterEach(async()=>db.exec('rollback'));
const state=async()=> (await db.query('select * from profile_content_freshness where profile_id=$1',[profile])).rows[0];
const rev=async()=>Number((await state()).content_revision);

test('ordinary admins read/edit but cannot review, withdraw or grant themselves capability',async()=>{
 await as(admin);await db.query('select review_profile_content($1,1)',[profile]);const checked=await state();
 await as(editor);
 assert.deepEqual(await state(),checked);
 assert.equal((await db.query('select user_id,can_review_profiles from portal_admins')).rows.length,1);
 await denied('select review_profile_content($1,1)',[profile]);
 await denied('select invalidate_profile_review($1,1,$2)',[profile,checked.reviewed_at]);
 await denied('update portal_admins set can_review_profiles=true where user_id=$1',[editor]);
 await denied('update profile_content_freshness set reviewed_at=now() where profile_id=$1',[profile]);
 await denied('select private.preserve_profile_review_on_edit()');
 await db.query("update company_profiles set description='Ordinary editor' where id=$1",[profile]);
 const changed=await state();assert.equal(Number(changed.content_revision),2);assert.equal(Number(changed.reviewed_revision),1);assert.deepEqual(changed.reviewed_at,checked.reviewed_at);
});

test('review-capable admin preserves an aligned review across edits without restarting annual cycle',async()=>{
 await as(admin);await db.query('select review_profile_content($1,1)',[profile]);const checked=await state();
 await db.query("update company_profiles set description='Editorial edit' where id=$1",[profile]);
 const changed=await state();assert.equal(Number(changed.content_revision),2);assert.equal(changed.reviewed_revision,changed.content_revision);
 assert.deepEqual(changed.reviewed_at,checked.reviewed_at);assert.equal(changed.reviewed_by,checked.reviewed_by);
 assert.equal(changed.content_update_source,'admin');assert.equal(changed.content_updated_by,admin);
 await db.query('select review_profile_content($1,$2)',[profile,await rev()]);
 const renewed=await state();assert.ok(renewed.reviewed_at>checked.reviewed_at);assert.equal(renewed.reviewed_revision,renewed.content_revision);assert.equal(renewed.content_revision,changed.content_revision);
});

test('review-capable edits never create, resurrect or silently repair an already stale review',async()=>{
 await as(admin);await db.query("update company_profiles set description='Unreviewed edit' where id=$1",[profile]);
 assert.equal((await state()).reviewed_at,null);assert.equal((await state()).reviewed_revision,null);
 await db.query('select review_profile_content($1,$2)',[profile,await rev()]);
 await as(editor);await db.query("update company_profiles set description='Makes stale' where id=$1",[profile]);const stale=await state();
 await as(admin);await db.query("update company_profiles set description='Still stale' where id=$1",[profile]);
 assert.equal((await state()).reviewed_revision,stale.reviewed_revision);assert.deepEqual((await state()).reviewed_at,stale.reviewed_at);
 await db.query('select review_profile_content($1,$2)',[profile,await rev()]);const checked=await state();
 await db.query('select invalidate_profile_review($1,$2,$3)',[profile,checked.content_revision,checked.reviewed_at]);const withdrawn=await state();
 await db.query("update company_profiles set tagline='Withdrawn edit' where id=$1",[profile]);
 const edited=await state();assert.deepEqual(edited.review_invalidated_at,withdrawn.review_invalidated_at);assert.equal(edited.review_invalidated_by,admin);
 assert.equal(edited.reviewed_revision,withdrawn.reviewed_revision);assert.deepEqual(edited.reviewed_at,withdrawn.reviewed_at);
});

test('overdue review remains overdue after review-capable edit, explicit renewal alone resets date',async()=>{
 await db.query("update profile_content_freshness set reviewed_revision=content_revision,reviewed_at='2020-01-01',reviewed_by=$1 where profile_id=$2",[admin,profile]);const old=await state();
 await as(admin);await db.query("update company_profiles set description='Overdue edit' where id=$1",[profile]);
 const edited=await state();assert.equal(edited.reviewed_revision,edited.content_revision);assert.deepEqual(edited.reviewed_at,old.reviewed_at);
 assert.ok(edited.reviewed_at<new Date('2021-01-01'));
 await db.query('select review_profile_content($1,$2)',[profile,await rev()]);assert.ok((await state()).reviewed_at>new Date('2021-01-01'));
});

test('canonical carry-forward covers taxonomy, text and media while presentation/no-op remains neutral',async()=>{
 await as(admin);await db.query('select review_profile_content($1,1)',[profile]);const checked=await state();
 const mutations=[
  ["insert into company_profile_travel_terms values($1,'theme:wellnessangebote')",[profile]],
  ["select insert_profile_content_block($1,'text','New text',null)",[profile]],
  ["update profile_content_block_images set caption='New caption' where id=$1",[image]],
  ['insert into company_profile_images(profile_id,storage_path) values($1,$2)',[profile,`profiles/${profile}/gallery/77777777-7777-4777-8777-777777777777.jpg`]],
 ];
 for(const [sql,args] of mutations){const before=await rev();await db.query(sql,args);const edited=await state();assert.equal(Number(edited.content_revision),before+1);assert.equal(edited.reviewed_revision,edited.content_revision);assert.deepEqual(edited.reviewed_at,checked.reviewed_at);}
 const current=await state();await db.query('update company_profiles set description=description where id=$1',[profile]);
 await db.query('update profile_content_block_images set zoom=1.5,focus_x=60 where id=$1',[image]);assert.deepEqual(await state(),current);
});
async function denied(sql,args=[]){await db.exec('savepoint denied');await assert.rejects(db.query(sql,args));await db.exec('rollback to savepoint denied; release savepoint denied');}
async function as(uid){await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);await db.exec('set local role authenticated');}

test('admin withdrawal preserves last review and content; re-review clears invalidation',async()=>{
 await as(admin);await db.query('select public.review_profile_content($1,$2)',[profile,await rev()]);
 const before=await state();
 await db.query('select public.invalidate_profile_review($1,$2,$3)',[profile,before.content_revision,before.reviewed_at]);
 const withdrawn=await state();
 for(const key of ['reviewed_at','reviewed_by','reviewed_revision','content_revision','content_updated_at']) assert.deepEqual(withdrawn[key],before[key]);
 assert.ok(withdrawn.review_invalidated_at);assert.equal(withdrawn.review_invalidated_by,admin);
 const publicDates=(await db.query('select * from public.public_profile_freshness($1)',[profile])).rows[0];assert.equal(publicDates.checked_at,null);
 await db.query('select public.review_profile_content($1,$2)',[profile,before.content_revision]);
 const reviewed=await state();assert.equal(reviewed.review_invalidated_at,null);assert.equal(reviewed.review_invalidated_by,null);assert.equal(reviewed.reviewed_revision,reviewed.content_revision);
});
test('withdrawal blocks anon/owner/foreign user and direct state writes',async()=>{
 await as(admin);await db.query('select public.review_profile_content($1,$2)',[profile,await rev()]);const before=await state();
 for(const uid of [owner,stranger]){
  await as(uid);await denied('select public.invalidate_profile_review($1,$2,$3)',[profile,before.content_revision,before.reviewed_at]);
  await denied('update public.profile_content_freshness set review_invalidated_at=now(),review_invalidated_by=$1 where profile_id=$2',[uid,profile]);
 }
 await db.exec('set local role anon');await denied('select public.invalidate_profile_review($1,$2,$3)',[profile,before.content_revision,before.reviewed_at]);
 await as(admin);assert.deepEqual(await state(),before);
});
test('withdrawal compares content AND exact last review, refuses no-review and repeated withdrawal',async()=>{
 await as(admin);await denied('select public.invalidate_profile_review($1,$2,$3)',[profile,await rev(),null]);
 await db.query('select public.review_profile_content($1,$2)',[profile,await rev()]);const first=await state();
 await db.query('select public.review_profile_content($1,$2)',[profile,await rev()]);
 await denied('select public.invalidate_profile_review($1,$2,$3)',[profile,first.content_revision,first.reviewed_at]);
 const current=await state();
 await denied('select public.invalidate_profile_review($1,$2,$3)',[profile,Number(current.content_revision)+1,current.reviewed_at]);
 await db.query('select public.invalidate_profile_review($1,$2,$3)',[profile,current.content_revision,current.reviewed_at]);
 const withdrawn=await state();await denied('select public.invalidate_profile_review($1,$2,$3)',[profile,current.content_revision,current.reviewed_at]);assert.deepEqual(await state(),withdrawn);
});

test('neutral backfill creates no invented content or review dates',async()=>{
 const s=await state();assert.equal(Number(s.content_revision),1);
 for(const k of ['content_updated_at','content_updated_by','content_update_source','reviewed_at','reviewed_by','reviewed_revision'])assert.equal(s[k],null);
 assert.equal((await db.query('select count(*)::int n from profile_content_freshness')).rows[0].n,2);
});
test('admin changes advance revision but do not review; owner changes invalidate prior review',async()=>{
 await as(admin);await db.query('select review_profile_content($1,1)',[profile]);
 await as(editor);
 await db.query("update company_profiles set description='Admin edit' where id=$1",[profile]);
 assert.equal(await rev(),2);assert.equal((await state()).content_update_source,'admin');assert.equal(Number((await state()).reviewed_revision),1);
 await as(owner);await db.query("update company_profiles set description='Provider edit' where id=$1",[profile]);
 await db.exec('reset role');assert.equal(await rev(),3);assert.equal((await state()).content_update_source,'provider');assert.equal((await state()).content_updated_by,owner);
});
test('atomic expected-revision comparison rejects a stale review without silently accepting newer content',async()=>{
 await as(admin);const seen=await rev();await db.query("update company_profiles set tagline='Concurrent write' where id=$1",[profile]);
 await db.exec('savepoint stale');
 await assert.rejects(db.query('select review_profile_content($1,$2)',[profile,seen]),error=>error.code==='PT409');
 await db.exec('rollback to savepoint stale; release savepoint stale');assert.equal((await state()).reviewed_at,null);
 await db.query('select review_profile_content($1,$2)',[profile,await rev()]);const s=await state();assert.equal(s.reviewed_revision,s.content_revision);assert.equal(s.reviewed_by,admin);
 const before=await rev();await db.query('select review_profile_content($1,$2)',[profile,before]);assert.equal(await rev(),before);
});
test('no-op save and technical timestamps/status never advance revision or overwrite review',async()=>{
 await as(admin);await db.query('select review_profile_content($1,1)',[profile]);const s=await state();
 await db.query('update company_profiles set description=description,display_name=display_name where id=$1',[profile]);
 await db.exec('reset role');await db.query('update company_profiles set updated_at=now(),approved_at=now(),submitted_at=now() where id=$1',[profile]);
 assert.deepEqual(await state(),s);
});
test('each ordinary content/contact/address field and company identity has the intended boundary',async()=>{
 await as(admin);
 for(const [field,value] of Object.entries({display_name:'New name',tagline:'New tagline',description:'New description',business_areas:'Travel',phone:'123',public_email:'contact@example.test',website:'https://example.test',street:'Street 1',postal_code:'12345',city:'City',region:'Region',country:'Austria'})){
  const before=await rev();await db.query(`update company_profiles set ${field}=$1 where id=$2`,[value,profile]);assert.equal(await rev(),before+1,field);
 }
});
test('taxonomy/category additions and removals invalidate the same profile review',async()=>{
 await as(admin);let before=await rev();
 await db.query("insert into company_profile_travel_terms values($1,'theme:wellnessangebote')",[profile]);assert.equal(await rev(),++before);
 await db.query("delete from company_profile_travel_terms where profile_id=$1",[profile]);assert.equal(await rev(),++before);
 await db.exec('reset role');await db.query("delete from company_profile_categories where profile_id=$1",[profile]);assert.equal(await rev(),++before);
 await db.query("insert into company_profile_categories(profile_id,category_id) values($1,'heizung')",[profile]);assert.equal(await rev(),++before);
});
test('block text/add/delete and gallery/alt/caption mutations advance the parent revision',async()=>{
 await as(admin);let before=await rev();
 const id=(await db.query("select insert_profile_content_block($1,'text','New text',null) id",[profile])).rows[0].id;assert.equal(await rev(),++before);
 await db.query("update profile_content_blocks set content='{\"text\":\"Changed text\"}' where id=$1",[id]);assert.equal(await rev(),++before);
 await db.query('delete from profile_content_blocks where id=$1',[id]);assert.equal(await rev(),++before);
 await db.query("update profile_content_block_images set alt_text='Accessible description',caption='Caption' where id=$1",[image]);assert.equal(await rev(),++before);
 const gallery=(await db.query('insert into company_profile_images(profile_id,storage_path,alt_text) values($1,$2,$3) returning id',[profile,`profiles/${profile}/gallery/77777777-7777-4777-8777-777777777777.jpg`,'Gallery'])).rows[0].id;assert.equal(await rev(),++before);
 await db.query("update company_profile_images set alt_text='Another alt' where id=$1",[gallery]);assert.equal(await rev(),++before);
 await db.query('delete from company_profile_images where id=$1',[gallery]);assert.equal(await rev(),++before);
});
test('crop/focus/zoom/sorting/block width and first default heading layout are not content edits',async()=>{
 await as(admin);const before=await rev();
 await db.query('update profile_content_block_images set focus_x=70,focus_y=20,zoom=1.5,sort_order=1 where id=$1',[image]);
 await db.query("update profile_content_blocks set sort_order=2,config=config||'{\"width_percent\":50}'::jsonb where id=$1",[block]);
 const h=(await db.query("insert into profile_content_blocks(profile_id,type,slot,content) values($1,'heading','about_heading','{\"text\":\"Über Profile\"}') returning id",[profile])).rows[0].id;
 await db.query("update profile_content_blocks set content=content||'{\"heading_align\":\"right\",\"body_align\":\"center\",\"hidden\":false,\"deleted_sections\":[],\"layout\":{\"width_percent\":50},\"order\":[],\"pair_layouts\":{}}'::jsonb where id=$1",[h]);
 assert.equal(await rev(),before);await db.query('delete from profile_content_blocks where id=$1',[h]);assert.equal(await rev(),before);
});
test('hiding/deleting section content and custom headings are genuine editorial changes',async()=>{
 await as(admin);let before=await rev();
 const h=(await db.query("insert into profile_content_blocks(profile_id,type,slot,content) values($1,'heading','about_heading','{\"text\":\"Custom title\"}') returning id",[profile])).rows[0].id;assert.equal(await rev(),++before);
 await db.query("update profile_content_blocks set content=content||'{\"heading_hidden\":true}' where id=$1",[h]);assert.equal(await rev(),++before);
 await db.query("update profile_content_blocks set content=content||'{\"deleted_sections\":[\"section:about\"]}' where id=$1",[h]);assert.equal(await rev(),++before);
});
test('shared image duplication/add/remove/replace belongs to the same subject, not crop history',async()=>{
 await as(admin);const before=await rev();
 const copy=(await db.query('select duplicate_profile_content_block($1,$2) id',[profile,block])).rows[0].id;assert.ok(await rev()>before);
 const original=(await db.query('select storage_path from profile_content_block_images where id=$1',[image])).rows[0].storage_path;
 await db.query('update profile_content_block_images set storage_path=$1 where block_id=$2',[`profiles/${profile}/blocks/${copy}/77777777-7777-4777-8777-777777777777.jpg`,copy]);
 assert.equal((await db.query('select storage_path from profile_content_block_images where id=$1',[image])).rows[0].storage_path,original);
 const changed=await rev();await db.query('delete from profile_content_blocks where id=$1',[copy]);assert.ok(await rev()>changed);
});
test('logo and video replacement/removal advance revision, Storage-only preparation does not',async()=>{
 await as(admin);let before=await rev();const video=`profiles/${profile}/video/77777777-7777-4777-8777-777777777777.mp4`;
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-profile-videos',$1,'{\"size\":100,\"mimetype\":\"video/mp4\"}')",[video]);assert.equal(await rev(),before);
 await db.query('update company_profiles set video_path=$1 where id=$2',[video,profile]);assert.equal(await rev(),++before);
 await db.query('update company_profiles set video_path=null where id=$1',[profile]);assert.equal(await rev(),++before);
 await db.query('update company_profiles set logo_path=$1 where id=$2',[`profiles/${profile}/logo/77777777-7777-4777-8777-777777777777.jpg`,profile]);assert.equal(await rev(),++before);
 await db.query('update company_profiles set logo_path=null where id=$1',[profile]);assert.equal(await rev(),++before);
});
test('anon cannot review/write/read internals; public dates exclude drafts and actor IDs',async()=>{
 await as(admin);await db.query('select review_profile_content($1,1)',[profile]);await db.exec('set local role anon');
 await denied('select review_profile_content($1,1)',[profile]);await denied('select * from profile_content_freshness');
 await denied('update profile_content_freshness set reviewed_revision=1');await denied('select private.track_profile_content()');
 const rows=(await db.query('select * from public_profile_freshness($1)',[profile])).rows;assert.equal(rows.length,1);assert.deepEqual(Object.keys(rows[0]).sort(),['checked_at','content_updated_at']);assert.ok(rows[0].checked_at);assert.equal(rows[0].content_updated_at,null);
 assert.equal((await db.query('select * from public_profile_freshness($1)',[draft])).rows.length,0);
});
test('owner/stranger cannot mark reviewed, forge freshness or observe internal states',async()=>{
 for(const uid of [owner,stranger]){
  await as(uid);await denied('select review_profile_content($1,1)',[profile]);
  assert.equal((await db.query('select * from profile_content_freshness')).rows.length,0);
  await denied('insert into profile_content_freshness(profile_id) values($1)',[profile]);await denied('delete from profile_content_freshness where profile_id=$1',[profile]);
  await denied("update profile_content_freshness set content_update_source='admin' where profile_id=$1",[profile]);
 }
});
test('public changed date replaces review date; review never changes dateModified source',async()=>{
 await as(admin);await db.query('select review_profile_content($1,1)',[profile]);
 await as(editor);
 await db.query("update company_profiles set description='Changed' where id=$1",[profile]);const updated=(await state()).content_updated_at;
 await db.exec('set local role anon');const publicState=(await db.query('select * from public_profile_freshness($1)',[profile])).rows[0];assert.equal(publicState.checked_at,null);assert.deepEqual(publicState.content_updated_at,updated);
 await as(admin);await db.query('select review_profile_content($1,2)',[profile]);assert.deepEqual((await state()).content_updated_at,updated);
});
test('trusted import/system mutations are attributed without creating fake users or reviews',async()=>{
 await db.query("select set_config('request.jwt.claim.sub','',true)");await db.query("select set_config('app.content_update_source','import',true)");
 await db.query("update company_profiles set description='Imported' where id=$1",[profile]);assert.equal((await state()).content_update_source,'import');assert.equal((await state()).content_updated_by,null);
 await db.query("select set_config('app.content_update_source','',true)");await db.query("update company_profiles set description='System change' where id=$1",[profile]);assert.equal((await state()).content_update_source,'system');assert.equal((await state()).reviewed_at,null);
});
test('new profile has a genuine creation date, cascading deletion leaves no orphan review state',async()=>{
 const id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 await db.query("insert into company_profiles(id,company_id,display_name,status) values($1,$2,'New profile','draft')",[id,owner]);
 const s=(await db.query('select * from profile_content_freshness where profile_id=$1',[id])).rows[0];assert.equal(Number(s.content_revision),1);assert.ok(s.content_updated_at);assert.equal(s.reviewed_at,null);
 await db.query('delete from company_profiles where id=$1',[id]);assert.equal((await db.query('select * from profile_content_freshness where profile_id=$1',[id])).rows.length,0);
});


test('contact names use canonical revision/no-op and preserve review capability semantics',async()=>{
 await as(admin); await db.query('select review_profile_content($1,1)',[profile]); const original=await state();
 await db.query("update company_profiles set contact_first_name='Anna',contact_last_name='Muster' where id=$1",[profile]);
 let changed=await state();assert.equal(Number(changed.content_revision),2);assert.equal(changed.reviewed_revision,changed.content_revision);assert.deepEqual(changed.reviewed_at,original.reviewed_at);
 await db.query("update company_profiles set contact_first_name='Anna',contact_last_name='Muster' where id=$1",[profile]);assert.deepEqual(await state(),changed);
 await as(owner);await db.query("update company_profiles set contact_last_name='' where id=$1",[profile]);await as(admin);changed=await state();assert.equal(Number(changed.content_revision),3);assert.equal(Number(changed.reviewed_revision),2);assert.deepEqual(changed.reviewed_at,original.reviewed_at);
});

test('contact grants retain public approved-only reads and owner/admin writes',async()=>{
 for(const role of ['anon','authenticated']) for(const col of ['contact_first_name','contact_last_name','contact_image_path']){
  assert.equal((await db.query('select has_column_privilege($1,$2,$3,$4) yes',[role,'company_profiles',col,'SELECT'])).rows[0].yes,true);
  assert.equal((await db.query('select has_column_privilege($1,$2,$3,$4) yes',[role,'company_profiles',col,'UPDATE'])).rows[0].yes,role==='authenticated');
 }
 await as(stranger);assert.equal((await db.query("update company_profiles set contact_first_name='Foreign' where id=$1 returning id",[profile])).rows.length,0);
 await db.exec('set local role anon');assert.equal((await db.query('select id,contact_first_name from company_profiles')).rows.length,1);
 await denied("update company_profiles set contact_first_name='Anon' where id=$1",[profile]);
});

test('contact image upload/link/replace/remove protects references and foreign media',async()=>{
 const path='profiles/'+profile+'/contact/77777777-7777-4777-8777-777777777777.png';
 const next='profiles/'+profile+'/contact/88888888-8888-4888-8888-888888888888.png';
 await as(owner);
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-media',$1,$2::jsonb)",[path,JSON.stringify({mimetype:'image/png',size:12})]);
 await db.query('update company_profiles set contact_image_path=$1 where id=$2',[path,profile]);await as(admin);assert.equal(await rev(),2);await as(owner);
 assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0);
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-media',$1,$2::jsonb)",[next,JSON.stringify({mimetype:'image/png',size:12})]);
 await db.query('update company_profiles set contact_image_path=$1 where id=$2',[next,profile]);await as(admin);assert.equal(await rev(),3);await as(owner);
 await db.query('delete from storage.objects where name=$1',[path]);
 await as(stranger);assert.equal((await db.query('delete from storage.objects where name=$1 returning id',[next])).rows.length,0);
 await denied("insert into storage.objects(bucket_id,name,metadata) values('company-media',$1,'{}')",[path]);
 await db.query("select set_config('request.jwt.claim.sub','',true)");await db.exec('set local role anon');assert.equal((await db.query('select name from storage.objects where name=$1',[next])).rows.length,1);
 await as(admin);await db.query('update company_profiles set contact_image_path=null where id=$1',[profile]);assert.equal(await rev(),4);
 await db.query('delete from storage.objects where name=$1',[next]);assert.equal((await db.query('select name from storage.objects where name=$1',[next])).rows.length,0);
});

test('contact rejects missing, foreign, oversized and invalid-type objects without revisions',async()=>{
 const base=await rev();await as(owner);
 const path='profiles/'+profile+'/contact/77777777-7777-4777-8777-777777777777.png';
 await denied('update company_profiles set contact_image_path=$1 where id=$2',[path,profile]);
 for(const metadata of [{mimetype:'image/png',size:5242881},{mimetype:'image/svg+xml',size:12}]){
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-media',$1,$2::jsonb)",[path,JSON.stringify(metadata)]);
  await denied('update company_profiles set contact_image_path=$1 where id=$2',[path,profile]);await db.query('delete from storage.objects where name=$1',[path]);
 }
 await as(admin);const foreign='profiles/'+draft+'/contact/77777777-7777-4777-8777-777777777777.png';
 await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-media',$1,jsonb_build_object('mimetype','image/png','size',12))",[foreign]);
 await denied('update company_profiles set contact_image_path=$1 where id=$2',[foreign,profile]);assert.equal(await rev(),base);
 await db.query('update company_profiles set contact_image_path=$1 where id=$2',[foreign,draft]);
 await db.query("select set_config('request.jwt.claim.sub','',true)");await db.exec('set local role anon');assert.equal((await db.query('select name from storage.objects where name=$1',[foreign])).rows.length,0);
});


test('contact helper is invoker, no custom Storage trigger and delete protection is restrictive',async()=>{
 const helper=(await db.query("select prosecdef from pg_proc where oid='public.can_access_profile_contact_image(text,boolean,boolean)'::regprocedure")).rows[0];assert.equal(helper.prosecdef,false);
 assert.equal((await db.query("select 1 from pg_trigger where tgrelid='storage.objects'::regclass and not tgisinternal")).rows.length,0);
 assert.equal((await db.query("select 1 from pg_proc where proname='guard_linked_contact_image_delete'")).rows.length,0);
 const policy=(await db.query("select permissive,cmd,roles from pg_policies where schemaname='storage' and policyname='company_contact_image_delete_unreferenced'")).rows[0];
 assert.equal(policy.permissive,'RESTRICTIVE');assert.equal(policy.cmd,'DELETE');assert.deepEqual(policy.roles,['authenticated']);
});

test('invoker contact policies allow owner/admin uploads and approved referenced-only anonymous reads',async()=>{
 const path='profiles/'+profile+'/contact/77777777-7777-4777-8777-777777777777.png';
 const draftPath='profiles/'+draft+'/contact/88888888-8888-4888-8888-888888888888.png';
 await as(admin);
 for(const value of [path,draftPath]) await db.query("insert into storage.objects(bucket_id,name,metadata) values('company-media',$1,jsonb_build_object('mimetype','image/png','size',12))",[value]);
 await db.query('update company_profiles set contact_image_path=$1 where id=$2',[draftPath,draft]);
 await db.query("select set_config('request.jwt.claim.sub','',true)");await db.exec('set local role anon');
 assert.equal((await db.query('select name from storage.objects where name=any($1::text[])',[[path,draftPath]])).rows.length,0);
 assert.equal((await db.query('select can_access_profile_contact_image($1,false) yes',[path])).rows[0].yes,false);
 await as(owner);await db.query('update company_profiles set contact_image_path=$1 where id=$2',[path,profile]);
 await as(admin);assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0);
 await db.query("select set_config('request.jwt.claim.sub','',true)");await db.exec('set local role anon');
 assert.deepEqual((await db.query('select name from storage.objects where name=any($1::text[])',[[path,draftPath]])).rows,[{name:path}]);
 assert.equal((await db.query('select can_access_profile_contact_image($1,false) yes',[path])).rows[0].yes,true);
 await denied("insert into storage.objects(bucket_id,name) values('company-media',$1)",[path]);
 await as(owner);await db.query('update company_profiles set contact_image_path=null where id=$1',[profile]);
 assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,1);
});

test('restrictive contact policy does not change logo/gallery or other bucket delete behavior',async()=>{
 const logo='profiles/'+profile+'/logo/77777777-7777-4777-8777-777777777777.png';
 const gallery='profiles/'+profile+'/gallery/88888888-8888-4888-8888-888888888888.png';
 await db.query("insert into storage.buckets(id,name,public) values('local-qa-other','local-qa-other',false)");
 await db.exec("create policy local_qa_other_read on storage.objects for select to authenticated using(bucket_id='local-qa-other');create policy local_qa_other_delete on storage.objects for delete to authenticated using(bucket_id='local-qa-other');");
 await db.query("insert into storage.objects(bucket_id,name) values('local-qa-other',$1)",['profiles/'+profile+'/contact/77777777-7777-4777-8777-777777777777.png']);
 await as(owner);
 for(const path of [logo,gallery]) await db.query("insert into storage.objects(bucket_id,name) values('company-media',$1)",[path]);
 await db.query('update company_profiles set logo_path=$1 where id=$2',[logo,profile]);
 await db.query('insert into company_profile_images(profile_id,storage_path,sort_order) values($1,$2,1)',[profile,gallery]);
 for(const path of [logo,gallery]) assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.length,0);
 await db.query('update company_profiles set logo_path=null where id=$1',[profile]);
 await db.query('delete from company_profile_images where storage_path=$1',[gallery]);
 for(const path of [logo,gallery]) assert.equal((await db.query('delete from storage.objects where name=$1 returning name',[path])).rows.filter(row=>row.name===path).length,1);
 assert.equal((await db.query("delete from storage.objects where bucket_id='local-qa-other' returning name")).rows.length,1);
});
