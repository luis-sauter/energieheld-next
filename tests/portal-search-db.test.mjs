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
  afterMigration = (await db.query("select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(p)) from company_profiles p),'ads',(select jsonb_agg(to_jsonb(a)) from company_ad_campaigns a),'targets',(select jsonb_agg(to_jsonb(t)) from company_ad_campaign_targets t),'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p)) as snapshot")).rows[0].snapshot;
});
after(async () => db?.close()); beforeEach(async () => db.exec('begin')); afterEach(async () => db.exec('rollback'));

test('exact, prefix, multiword, German case/umlaut/forms and description/taxonomy ranking', async () => {
  await actor();
  for (const word of ['Pension Sonnenhof', 'PENSION SONN', 'Nordic Walking Meransen']) {
    const hit = (await query(word)).hits[0]; assert.equal(hit.title, 'Pension Sonnenhof'); assert.doesNotMatch(hit.excerpt, /StopSel|StartSel|<\/?b>/);
  }
  assert.equal((await query('SUEDTIROL')).hits[0].title, 'Golfhotel Andreus');
  assert.equal((await query('Tagungsräume')).hits[0].title, 'Hotel zur Post');
  const words = (await db.query("select portal_search_vector('Österreich')=portal_search_vector('Oesterreich') as equal")).rows[0]; assert.equal(words.equal, true);
  assert.ok((await query('Pension Sonnenhof')).hits[0].rank >= 1000);
});

test('visible CMS copy found; hidden/deleted field sections and hidden free blocks/captions excluded', async () => {
  const block = crypto.randomUUID();
  await db.query("insert into profile_content_blocks(id,profile_id,type,slot,content) values($1,$2,'text',null,$3)", [block, ids[0], { text: 'Radtouren sind die ideale Methode, die Sächsische Schweiz ausgiebig zu erkunden.' }]);
  await actor(); assert.equal((await query('Sächsische Schweiz')).hits[0].title, 'Pension Sonnenhof');
  await actor('postgres');
  await db.query("insert into profile_content_blocks(profile_id,type,slot,content) values($1,'heading','about_heading',$2)", [ids[0], { text: 'Über Pension Sonnenhof', hidden: true, hidden_blocks: [block] }]);
  await actor(); assert.equal((await query('Sächsische Schweiz')).total, 0); assert.equal((await query('Hochplateau')).total, 0);
  await actor('postgres'); await db.query("update profile_content_blocks set content=$1 where slot='about_heading'", [{ text: 'Über Pension Sonnenhof', deleted_sections: ['section:about'], hidden_blocks: [block] }]);
  await actor(); assert.equal((await query('Hochplateau')).total, 0); assert.equal((await query('Pension Sonnenhof')).total, 1);
});

test('only approved travel profiles, even for owner/admin; demo alias never leaks energy copy', async () => {
  await db.query("insert into profile_content_blocks(profile_id,type,slot,content) values($1,'text',null,$2)", [ids[3], { text: 'Energieberatung Demo' }]);
  for (const status of ['draft', 'pending', 'rejected']) {
    await actor('postgres'); await db.query('update company_profiles set status=$1 where id=$2', [status, ids[0]]);
    for (const [role, id] of [['anon',''], ['authenticated',owner], ['authenticated',admin]]) { await actor(role,id); assert.equal((await query('Pension Sonnenhof')).total, 0); }
  }
  await actor(); assert.equal((await query('Energieberatung')).total, 0);
  assert.equal((await query('Demo GmbH')).hits[0].url, '/unterkuenfte/demo-gmbh');
});

test('public ad projection excludes pause/expired/drafts and internal campaign/contact data', async () => {
  const id = crypto.randomUUID();
  await db.query("insert into company_ad_campaigns(id,profile_id,internal_name,headline,body_text,target_url,image_path,status,approved_start_date,approved_end_date) values($1,$2,'Interne Vertragsnotiz','Neue Schänke','Sächsische Schweiz','https://www.neue-schaenke.de/',$4,'approved',$3,$3)", [id, ids[0], today, `campaigns/${id}/creative/${crypto.randomUUID()}.png`]);
  await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'homepage','sidebar_top')", [id]);
  await actor(); let response = await query('Neue Schaenke'); assert.equal(response.ads.length, 1); assert.ok(response.ads[0].rank > 0); assert.equal(JSON.stringify(response).includes('Interne Vertragsnotiz'), false);
  for (const status of ['paused','draft','pending','rejected']) { await actor('postgres'); await db.query('update company_ad_campaigns set status=$1 where id=$2', [status,id]); await actor(); assert.deepEqual((await query('Neue Schänke')).ads, []); }
  await actor('postgres'); await db.query("update company_ad_campaigns set status='approved',approved_start_date='2000-01-01',approved_end_date='2000-01-02' where id=$1", [id]); await actor(); assert.deepEqual((await query('Neue Schänke')).ads, []);
});

test('empty/punctuation/very long input, limit/offset caps and invoker permissions', async () => {
  assert.deepEqual(afterMigration, baseline);
  await actor(); for (const word of ['', '!!!', "' | & : * ( )", 'x'.repeat(2000)]) assert.equal((await query(word)).total, 0);
  const metadata = (await db.query("select prosecdef,proconfig from pg_proc where proname='search_public_portal'")).rows[0]; assert.equal(metadata.prosecdef, false); assert.ok(metadata.proconfig.includes('search_path=""'));
  assert.equal((await db.query("select has_table_privilege('anon','portal_search_documents','UPDATE') as write")).rows[0].write, false);
  assert.equal((await db.query("select search_public_portal('Hotel',1,0) as result")).rows[0].result.hits.length, 1);
});

test('code catalog uses the same German FTS without persisting supplied documents', async () => {
  const catalog = [{ id: 'oesterreich', type: 'destination', title: 'Österreich', body: 'Reiseziele im deutschsprachigen Raum', url: '/reiseziele/oesterreich' },
    { id: 'nordic-walking', type: 'theme', title: 'Nordic Walking', body: 'Touren durch reizvolle Naturlandschaften', url: '/mottoreisen/nordic-walking' }];
  await actor();
  for (const [word, expected] of [['Oesterreich','Österreich'],['Naturlandschaft','Nordic Walking']]) {
    const response = (await db.query('select search_public_portal($1,20,0,$2,$3) as result', [word, [], catalog])).rows[0].result;
    assert.equal(response.catalog_hits[0].title, expected);
  }
  assert.equal((await db.query("select search_public_portal('Österreich',20,0,'{}','null') as result")).rows[0].result.catalog_hits.length, 0);
  assert.equal((await db.query("select reloptions from pg_class where relname='portal_search_documents'")).rows[0].reloptions.includes('security_invoker=true'), true);
});

test('only captions of actual visible profile images can become results', async () => {
  await actor('postgres', admin);
  const block = crypto.randomUUID(), path = `profiles/${ids[0]}/blocks/${block}/${crypto.randomUUID()}.jpg`;
  await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values($1,$2,'image_grid','{}','{\"columns\":1}')", [block, ids[0]]);
  await db.query("insert into storage.objects(bucket_id,name) values('company-media',$1)", [path]);
  await db.query("insert into profile_content_block_images(block_id,storage_path,caption) values($1,$2,'Blausee in der Schweiz')", [block,path]);
  await actor(); assert.equal((await query('Blausee')).hits[0].title, 'Pension Sonnenhof');
  await actor('postgres',admin); await db.query("insert into profile_content_blocks(profile_id,type,slot,content) values($1,'heading','about_heading',$2)", [ids[0], { text: 'Über Pension Sonnenhof', hidden_blocks: [block] }]);
  await actor(); assert.equal((await query('Blausee')).total, 0);
});
