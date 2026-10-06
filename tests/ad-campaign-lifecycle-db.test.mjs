import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import './helpers/load-ts.mjs';
import { selectableArchivedBanners } from '../src/lib/ad-archive.ts';
import { createMediaTestDatabase } from './helpers/media-database.mjs';

let db, ids, today, baseline, afterMigration;
const admin = '33333333-3333-4333-8333-333333333333';
const owner = '11111111-1111-4111-8111-111111111111';
const read = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const query = async value => (await db.query('select search_public_portal($1,100,0) as result', [value])).rows[0].result;
async function actor(role = 'anon', id = '') {
  await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]); await db.exec(`set local role ${role}`);
}
before(async () => {
  db = await createMediaTestDatabase();
  const travelGuard = await read('20260926082908_unify_reiseportal_admin_editing.sql');
  await db.exec(travelGuard.slice(0, travelGuard.indexOf('-- Public SELECT')));
  await db.exec('create table auth.users(id uuid primary key); alter table company_profiles add column street text; grant select(street) on company_profiles to anon;');
  await db.query('insert into portal_admins values($1)', [admin]);
  await db.query('insert into companies values($1,NULL,\'Pension Sonnenhof\')', [owner]);
  ids = ['pension-sonnenhof', 'hotel-zur-post', 'golfhotel-andreus', 'energieheld-demo-gmbh-c3351d59'].map(() => crypto.randomUUID());
  ids[3] = '31ae7d1e-26a7-4161-8d14-f5ee4735f5d4';
  for (const [index, [slug, name, description, city, country]] of [
    ['pension-sonnenhof', 'Pension Sonnenhof', 'Das Hochplateau von Meransen ist ein Paradies für Nordic Walking Fans.', 'Meransen', 'Italien'],
    ['hotel-zur-post', 'Hotel zur Post', 'In unserem Tagungshotel in Bayern gibt es drei helle Tagungsräume.', 'Bayern', 'Deutschland'],
    ['golfhotel-andreus', 'Golfhotel Andreus', 'Golf in Südtirol auf der Sonnenseite der Alpen.', 'Südtirol', 'Italien'],
    ['energieheld-demo-gmbh-c3351d59', 'Energieheld Demo GmbH', 'Energieberatung', 'München', 'Deutschland'],
  ].entries()) await db.query("insert into company_profiles(id,company_id,slug,display_name,description,city,country,status) values($1,$2,$3,$4,$5,$6,$7,'approved')", [ids[index], owner, slug, name, description, city, country]);
  for (const file of ['20260924171344_profile_content_blocks.sql', '20260924202803_profile_image_grid_blocks.sql', '20260925083617_profile_block_image_captions.sql']) await db.exec(await read(file));
  const taxonomy = await read('20260926160000_reiseportal_travel_taxonomy.sql');
  await db.exec(taxonomy.slice(0, taxonomy.indexOf('INSERT INTO public.company_profile_travel_terms')) + taxonomy.slice(taxonomy.indexOf('ALTER TABLE public.travel_terms ENABLE')));
  await db.query("insert into company_profile_travel_terms values($1,'theme:nordic-walking')", [ids[0]]);
  for (const file of ['20260917203041_company_ad_campaigns.sql', '20260918202110_company_ad_campaign_targets.sql', '20260925091403_company_directory_order.sql', '20260925103400_directory_demo_and_sidebar_order.sql', '20260925160039_expand_legacy_advertising_rail.sql', '20260930120000_ad_target_placements.sql', '20260930143000_portal_ad_target_areas.sql', '20260930170000_editorial_ad_campaigns.sql', '20260930190000_inline_banner_presentation.sql', '20261001090000_fixed_banner_slot_contents.sql', '20261001170000_banner_display_order.sql']) await db.exec(await read(file));
  today = (await db.query("select (now() at time zone 'Europe/Berlin')::date::text as day")).rows[0].day;
  baseline = (await db.query("select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p)) from company_profiles p),'ads',(select jsonb_agg(to_jsonb(a)-'lifecycle_group_id') from company_ad_campaigns a),'targets',(select jsonb_agg(to_jsonb(t)) from company_ad_campaign_targets t),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p)) as snapshot")).rows[0].snapshot;
  await db.exec(await read('20261001190000_public_portal_search.sql'));
  await db.exec(await read('20261001193000_portal_search_plain_excerpts.sql'));
  await db.exec(await read('20261001230000_banner_search_metadata.sql'));
  await db.exec(await read('20261002160000_ad_presentation_crop.sql'));
  await db.exec(await read('20261006120000_ad_campaign_lifecycle.sql'));
  await db.exec(await read('20261006140000_ad_campaign_lineage.sql'));
  afterMigration = (await db.query("select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p)) from company_profiles p),'ads',(select jsonb_agg(to_jsonb(a)-'lifecycle_group_id') from company_ad_campaigns a),'targets',(select jsonb_agg(to_jsonb(t)) from company_ad_campaign_targets t),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p)) as snapshot")).rows[0].snapshot;
});
after(async () => db?.close()); beforeEach(async () => db.exec('begin')); afterEach(async () => db.exec('rollback'));

async function save(id, key, name='Belegter Banner', city='München', terms=['theme:wellnessangebote']) {
  return db.query('select save_ad_banner_search_metadata($1,$2,$3,$4,$5,$6)', [id,key,name,'80331',city,terms]);
}
async function campaign(shared=true) {
  const id=crypto.randomUUID(), path=`campaigns/${id}/creative/${crypto.randomUUID()}.png`;
  await actor('postgres');
  await db.query("insert into company_ad_campaigns(id,profile_id,internal_name,headline,body_text,target_url,image_path,status,approved_start_date,approved_end_date) values($1,$2,'PrivateKundenNotiz','Öffentlicher Banner','Öffentliche Beschreibung','https://example.org/',$4,'approved',$3,$3)",[id,ids[0],today,path]);
  await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)",[path]);
  await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'homepage','sidebar_top')",[id]);
  if(shared) await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,target_key,placement) values($1,'portal_area','mottoreisen/natur-pur','sidebar_bottom')",[id]);
  return id;
}

const rpc = (id, action, image = null) => db.query('select admin_ad_lifecycle($1,$2,$3) as id',[id,action,image]);
const row = async id => (await db.query('select * from company_ad_campaigns where id=$1',[id])).rows[0];
test('migration preserves existing profiles, campaigns, targets and all RLS policies',()=>{
 assert.deepEqual(afterMigration.profiles,baseline.profiles);
 assert.deepEqual(afterMigration.ads,baseline.ads);
 assert.deepEqual(afterMigration.targets,baseline.targets);
 assert.deepEqual(afterMigration.policies.filter(p=>!p.tablename.startsWith('ad_banner_search_')&&p.tablename!=='ad_legacy_banner_search_sources'),baseline.policies);
});
test('archive preserves original bookings, excludes public delivery/search/availability and blocks edits',async()=>{
 const id=await campaign();await actor('authenticated',admin);await save(id,null,'LifecycleNeedle');
 await actor('postgres');const original=await row(id);const targets=(await db.query('select * from company_ad_campaign_targets where campaign_id=$1',[id])).rows;
 await actor('authenticated',admin);await rpc(id,'archive');await actor('postgres');const archived=await row(id);
 assert.ok(archived.archived_at);assert.deepEqual({...archived,archived_at:null,updated_at:original.updated_at},original);
 assert.deepEqual((await db.query('select * from company_ad_campaign_targets where campaign_id=$1',[id])).rows,targets);
 await actor();assert.equal((await db.query("select * from get_active_ad_campaigns('homepage',null)")).rows.length,0);assert.equal((await query('LifecycleNeedle')).banner_metadata.some(x=>x.banner_key===`campaign:${id}`),false);
 await actor('authenticated',admin);assert.equal((await db.query('select * from get_ad_slot_availability($1,$1,null)',[today])).rows.length,0);
 await db.exec('savepoint edit');await assert.rejects(save(id,null,'Changed'));await db.exec('rollback to edit');
});
test('only admins archive, reuse or delete; live campaigns cannot be deleted',async()=>{
 const id=await campaign();
 for(const [role,user] of [['anon',''],['authenticated',owner]])for(const action of ['archive','reuse','prepare_delete','delete']){
  await actor(role,user);await db.exec('savepoint denied');await assert.rejects(rpc(id,action));await db.exec('rollback to denied');
 }
 await actor('authenticated',admin);for(const action of ['reuse','prepare_delete','delete']){await db.exec('savepoint denied');await assert.rejects(rpc(id,action));await db.exec('rollback to denied');}
});
test('pending booking blocks availability only until archived',async()=>{
 const id=await campaign(false);
 await db.query("update company_ad_campaigns set status='pending',requested_start_date=$1,requested_end_date=$1 where id=$2",[today,id]);
 await actor('authenticated',admin);
 const availability=async()=> (await db.query('select * from get_ad_slot_availability($1,$1,null)',[today])).rows;
 assert.deepEqual(await availability(),[{target_type:'homepage',category_id:null,target_key:null,placement:'sidebar_top',status:'pending'}]);
 await rpc(id,'archive');
 assert.deepEqual(await availability(),[]);
});
test('reuse creates independent draft, metadata and own creative, never copies bookings or historic dates',async()=>{
 const id=await campaign();await db.query("update company_ad_campaigns set requested_start_date='2000-01-01',requested_end_date='2000-01-02' where id=$1",[id]);await actor('authenticated',admin);await save(id,null,'LifecycleNeedle');await rpc(id,'archive');
 const copy=(await rpc(id,'reuse')).rows[0].id;assert.notEqual(copy,id);await actor('postgres');const original=await row(id), draft=await row(copy);
 assert.equal(draft.status,'draft');assert.equal(draft.archived_at,null);assert.equal(draft.internal_name,original.internal_name);assert.equal(draft.headline,original.headline);assert.equal(draft.target_url,original.target_url);assert.equal(draft.image_path,null);assert.equal(draft.approved_start_date,null);assert.equal(draft.submitted_at,null);
 assert.notEqual(draft.requested_start_date,original.requested_start_date);assert.notEqual(draft.requested_end_date,original.requested_end_date);
 assert.equal((await db.query('select * from company_ad_campaign_targets where campaign_id=$1',[copy])).rows.length,0);
 assert.equal((await db.query('select city from ad_banner_search_metadata where campaign_id=$1',[copy])).rows[0].city,'M\u00fcnchen');
 assert.equal((await db.query('select * from ad_banner_search_terms where banner_key=$1',[`campaign:${copy}`])).rows.length,1);
 const path=`campaigns/${copy}/creative/${crypto.randomUUID()}.png`;await actor('authenticated',admin);await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)",[path]);await rpc(copy,'attach_copy',path);
 await actor('postgres');assert.equal((await row(copy)).image_path,path);assert.deepEqual(await row(id),original);
 await actor('authenticated',admin);await rpc(id,'prepare_delete');await db.query("delete from storage.objects where bucket_id='ad-media' and name=$1",[original.image_path]);await rpc(id,'delete');await actor('postgres');
 assert.equal(await row(id),undefined);assert.equal((await row(copy)).image_path,path);assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,1);
 for(const table of ['company_ad_campaign_targets','ad_banner_search_metadata'])assert.equal((await db.query(`select * from ${table} where campaign_id=$1`,[id])).rows.length,0);
 assert.equal((await db.query('select * from ad_banner_search_terms where banner_key=$1',[`campaign:${id}`])).rows.length,0);
});
test('delete is retryable after cleanup failure; referenced creative stays protected until explicit admin intent',async()=>{
 const id=await campaign();await actor('postgres');const path=(await row(id)).image_path;await actor('authenticated',admin);await rpc(id,'archive');
 await db.query("delete from storage.objects where name=$1",[path]);await actor('postgres');assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,1);
 await actor('authenticated',admin);await rpc(id,'prepare_delete');await db.exec('savepoint failed');await assert.rejects(rpc(id,'delete'));await db.exec('rollback to failed');
 await actor('authenticated',owner);await db.query('delete from storage.objects where name=$1',[path]);await actor('postgres');assert.equal((await db.query('select * from storage.objects where name=$1',[path])).rows.length,1);
 await actor('authenticated',admin);await db.query('delete from storage.objects where name=$1',[path]);await rpc(id,'delete');await actor('postgres');assert.equal(await row(id),undefined);
});
test('delete removes only matching creative crop references and retains fixed slot mappings',async()=>{
 const id=await campaign();await actor('postgres');const image=(await row(id)).image_path;
 await db.query("insert into ad_slot_presentations(target_type,placement,size,display_source,focus_x,focus_y,zoom,crop_reference) values('homepage','sidebar_top','large','sidebar_bottom',50,50,1,$1)",[`campaign:${id}:${image}`]);
 const before=(await db.query("select * from ad_slot_presentations where target_type='homepage' and placement='sidebar_top'")).rows[0];
 await actor('authenticated',admin);await rpc(id,'archive');await rpc(id,'prepare_delete');await db.query('delete from storage.objects where name=$1',[image]);await rpc(id,'delete');await actor('postgres');
 const after=(await db.query("select * from ad_slot_presentations where target_type='homepage' and placement='sidebar_top'")).rows[0];
 assert.equal(after.crop_reference,null);assert.equal(after.focus_x,null);assert.equal(after.display_source,before.display_source);assert.equal(after.size,before.size);assert.equal(after.placement,before.placement);
});



test('lineage persists through three cycles, blocks repeat reuse and retains booking history',async()=>{
 const original=await campaign();await actor('authenticated',admin);await rpc(original,'archive');
 const before=(await db.query('select * from company_ad_campaign_targets where campaign_id=$1',[original])).rows;
 let current=original;
 assert.equal(selectableArchivedBanners((await db.query('select * from company_ad_campaigns')).rows).length,1);
 for(let cycle=0;cycle<3;cycle++){
  const copy=(await rpc(current,'reuse')).rows[0].id;
 assert.equal(selectableArchivedBanners((await db.query('select * from company_ad_campaigns')).rows).length,0);
  await actor('postgres');assert.equal((await row(current)).lifecycle_group_id,original);assert.equal((await row(copy)).lifecycle_group_id,original);
  assert.equal((await db.query('select * from company_ad_campaign_targets where campaign_id=$1',[copy])).rows.length,0);
  await actor('authenticated',admin);await db.exec('savepoint duplicate');await assert.rejects(rpc(original,'reuse'));await db.exec('rollback to duplicate');
  await rpc(copy,'archive');current=copy;
 assert.equal(selectableArchivedBanners((await db.query('select * from company_ad_campaigns')).rows).length,1);
 }
 await actor('postgres');assert.equal((await db.query('select * from company_ad_campaigns where lifecycle_group_id=$1',[original])).rows.length,4);
 assert.deepEqual((await db.query('select * from company_ad_campaign_targets where campaign_id=$1',[original])).rows,before);
});
test('lineage migration adds no ordinary write privileges and keeps archived creative immutable',async()=>{
 const id=await campaign();await actor('authenticated',admin);await rpc(id,'archive');const copy=(await rpc(id,'reuse')).rows[0].id;
 await actor('postgres');for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_column_privilege($1,'company_ad_campaigns','lifecycle_group_id','UPDATE') as allowed",[role])).rows[0].allowed,false);
 for(const sql of ['update company_ad_campaigns set lifecycle_group_id=gen_random_uuid() where id=$1','update company_ad_campaigns set headline=\'Changed\' where id=$1']){
  await db.exec('savepoint immutable');await assert.rejects(db.query(sql,[id]));await db.exec('rollback to immutable');
 }
 assert.notEqual(copy,id);
});

