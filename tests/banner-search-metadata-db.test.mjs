import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  baseline = (await db.query("select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p)) from company_profiles p),'ads',(select jsonb_agg(to_jsonb(a)) from company_ad_campaigns a),'targets',(select jsonb_agg(to_jsonb(t)) from company_ad_campaign_targets t),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p)) as snapshot")).rows[0].snapshot;
  await db.exec(await read('20261001190000_public_portal_search.sql'));
  await db.exec(await read('20261001193000_portal_search_plain_excerpts.sql'));
  await db.exec(await read('20261001230000_banner_search_metadata.sql'));
  afterMigration = (await db.query("select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p)) from company_profiles p),'ads',(select jsonb_agg(to_jsonb(a)) from company_ad_campaigns a),'targets',(select jsonb_agg(to_jsonb(t)) from company_ad_campaign_targets t),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p)) as snapshot")).rows[0].snapshot;
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
test('additive schema leaves existing profiles, campaigns, targets and old policies intact; proven legacy has no guessed metadata',async()=>{
  assert.deepEqual(afterMigration.profiles,baseline.profiles);assert.deepEqual(afterMigration.ads,baseline.ads);assert.deepEqual(afterMigration.targets,baseline.targets);
  assert.deepEqual(afterMigration.policies.filter(row=>!row.tablename.startsWith('ad_banner_search_')&&row.tablename!=='ad_legacy_banner_search_sources'),baseline.policies);
  const rows=(await db.query('select count(*)::int as count from ad_legacy_banner_search_sources')).rows;assert.equal(rows[0].count,143);
  assert.equal((await db.query("select count(*)::int as count from ad_banner_search_metadata where postal_code<>'' or city<>''")).rows[0].count,0);
  assert.equal((await db.query('select count(*)::int as count from ad_banner_search_terms')).rows[0].count,0);
});
test('admin edits shared campaign metadata atomically, no booking/presentation/media/date changes, visible on all pages and after reload',async()=>{
  const id=await campaign();
  const snapshot=async()=> (await db.query("select jsonb_build_object('campaign',to_jsonb(a)-'headline'-'updated_at','targets',(select jsonb_agg(to_jsonb(t) order by id) from company_ad_campaign_targets t),'presentations',(select jsonb_agg(to_jsonb(p)) from ad_slot_presentations p),'storage',(select jsonb_agg(to_jsonb(o)) from storage.objects o)) as data from company_ad_campaigns a where id=$1",[id])).rows[0].data;
  const before=await snapshot();await actor('authenticated',admin);await save(id,null);await actor('postgres');assert.deepEqual(await snapshot(),before);
  await actor();const result=await query('80331 München Wellness');assert.equal(result.banner_metadata.filter(row=>row.banner_key===`campaign:${id}`&&row.rank>0).length,2);
  assert.equal((await db.query('select city from ad_banner_search_metadata where campaign_id=$1',[id])).rows[0].city,'München');
  assert.equal(JSON.stringify(await query('PrivateKundenNotiz')).includes('PrivateKundenNotiz'),false);
});
test('anon/owner cannot mutate metadata; admin cannot invent taxonomy, legacy identity or campaign IDs',async()=>{
  const id=await campaign();
  for(const [role,user] of [['anon',''],['authenticated',owner]]){await actor(role,user);await db.exec('savepoint denied');await assert.rejects(save(id,null));await db.exec('rollback to denied');}
  await actor('authenticated',admin);
  for(const args of [[crypto.randomUUID(),null], [null,'legacy:https://invented.example/'],[id,null,'Valid','Ort',['feature:invented']]]){
    await db.exec('savepoint invalid');await assert.rejects(save(...args));await db.exec('rollback to invalid');
  }
  for(const role of ['anon','authenticated']){
    const permissions=(await db.query("select has_table_privilege($1,'ad_banner_search_metadata','INSERT,UPDATE,DELETE') as writable, has_table_privilege($1,'ad_banner_search_terms','INSERT,UPDATE,DELETE') as terms",[role])).rows[0];
    assert.deepEqual(permissions,{writable:false,terms:false});
  }
});
test('legacy metadata is central across homepage, A–Z, theme and destination, no duplicate copy and hidden/replaced legacy excluded',async()=>{
  const key='legacy:https://city-apart-dresden.de/';await actor('authenticated',admin);await save(null,key,'City Apart Dresden');
  await actor();let result=await query('80331');assert.ok(result.banner_metadata.filter(row=>row.banner_key===key&&row.rank>0).length>=2);
  await actor('postgres');await db.exec("insert into ad_slot_presentations(target_type,target_key,placement,size,legacy_hidden) values('homepage',NULL,'sidebar_top','large',true),('experts_directory',NULL,'sidebar_top','large',true) on conflict(target_type,target_key,placement) do update set legacy_hidden=true");
  await actor();result=await query('80331');assert.ok(result.banner_metadata.some(row=>row.banner_key===key&&row.path==='/'), 'wide creative still legitimately visible');
  await actor('postgres');await db.exec("insert into ad_slot_presentations(target_type,target_key,placement,size,legacy_hidden) values('homepage',NULL,'sidebar_06','small',true),('experts_directory',NULL,'sidebar_06','small',true) on conflict(target_type,target_key,placement) do update set legacy_hidden=true");
  await actor();assert.equal((await query('80331')).banner_metadata.some(row=>row.banner_key===key&&(row.path==='/'||row.path==='/unterkuenfte-a-z')),false);
  const id=await campaign();await actor('authenticated',admin);await save(id,null,'Replacement');await actor();assert.equal((await query('City Apart')).banner_metadata.some(row=>row.banner_key===key&&row.path==='/'),false);
});
test('nonpublic and missing-image campaign metadata never leaks through public SELECT or search, even to admin search',async()=>{
  const id=await campaign();await actor('authenticated',admin);await save(id,null,'SecretBanner');
  for(const status of ['draft','pending','rejected','paused']){
    await actor('postgres');await db.query('update company_ad_campaigns set status=$1 where id=$2',[status,id]);
    for(const [role,user] of [['anon',''],['authenticated',admin]]){await actor(role,user);assert.equal((await query('SecretBanner')).banner_metadata.some(row=>row.banner_key===`campaign:${id}`),false);}
    await actor();assert.equal((await db.query('select * from ad_banner_search_metadata where campaign_id=$1',[id])).rows.length,0);
  }
  await actor('postgres');await db.query("update company_ad_campaigns set status='approved',approved_end_date='2000-01-01',approved_start_date='2000-01-01' where id=$1",[id]);await actor();assert.equal((await query('SecretBanner')).banner_metadata.some(row=>row.banner_key===`campaign:${id}`),false);
  await actor('postgres');await db.query('update company_ad_campaigns set approved_start_date=$1,approved_end_date=$1 where id=$2',[today,id]);await db.exec("delete from storage.objects where bucket_id='ad-media'");await actor();assert.equal((await query('SecretBanner')).banner_metadata.some(row=>row.banner_key===`campaign:${id}`),false);
});
test('new registered areas are searched from DB without a hard-coded source list',async()=>{
  const id=await campaign(false);await actor('postgres');
  await db.exec("insert into ad_portal_areas(target_key,section,slug) values('reiseziele/belegtes-ziel','reiseziele','belegtes-ziel')");
  await db.query("update company_ad_campaign_targets set target_type='portal_area',target_key='reiseziele/belegtes-ziel' where campaign_id=$1",[id]);
  await actor('authenticated',admin);await save(id,null);await actor();assert.ok((await query('München')).banner_metadata.some(row=>row.path==='/reiseziele/belegtes-ziel'&&row.rank>0));
});
