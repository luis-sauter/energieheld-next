import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMediaTestDatabase } from './helpers/media-database.mjs';

let db, ids, today, baseline, afterMigration;
const admin = '33333333-3333-4333-8333-333333333333';
const owner = '11111111-1111-4111-8111-111111111111';
const read = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
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
  await db.exec(await read('20261002160000_ad_presentation_crop.sql'));
  await db.exec(await read('20261006120000_ad_campaign_lifecycle.sql'));
  await db.exec(await read('20261006143408_public_travel_search_banners.sql'));
  await db.exec(await read('20261006145449_public_travel_search_banner_terms.sql'));
  await db.exec(await read('20261006140000_ad_campaign_lineage.sql'));
  await db.exec(await read('20261006155115_travel_search_advertisers.sql'));
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

test('read projection grants only execution, fixed search path and no existing data/policies changes',async()=>{
  assert.deepEqual(afterMigration.profiles,baseline.profiles);
  assert.deepEqual(afterMigration.ads,baseline.ads);
  assert.deepEqual(afterMigration.targets,baseline.targets);
  for(const role of ['anon','authenticated']) {
    const rights=(await db.query("select has_function_privilege($1,'public_travel_search_banners()','EXECUTE') as readable,has_table_privilege($1,'ad_banner_search_terms','INSERT,UPDATE,DELETE') as writable",[role])).rows[0];
    assert.deepEqual(rights,{readable:true,writable:false});
  }
  const definition=(await db.query("select proconfig from pg_proc where oid='public_travel_search_banners()'::regprocedure")).rows[0];
  assert.ok(definition.proconfig.some(x=>x.startsWith('search_path=')));
});
const projection = async()=> (await db.query('select public_travel_search_banners() as result')).rows[0].result;
test('anon projection exposes structured metadata and approved profile relationship, not private campaign fields',async()=>{
  const id=await campaign();await actor('authenticated',admin);await save(id,null);await actor();
  const result=await projection();const rows=result.metadata.filter(b=>b.banner_key===`campaign:${id}`);
  assert.equal(rows.length,2);assert.ok(rows.every(b=>b.profile_id===ids[0]));
  assert.deepEqual(rows[0].term_keys,['theme:wellnessangebote']);
  assert.equal(JSON.stringify(result).includes('PrivateKundenNotiz'),false);
  assert.ok(!('internal_name' in result.ads[0]));
});
test('draft, pending, paused, rejected, expired, future, archived and missing image are excluded from metadata',async()=>{
  const id=await campaign();await actor('authenticated',admin);await save(id,null);
  for(const status of ['draft','pending','paused','rejected']) {
    await actor('postgres');await db.query('update company_ad_campaigns set status=$1 where id=$2',[status,id]);
    await actor();assert.equal((await projection()).metadata.some(b=>b.banner_key===`campaign:${id}`),false);
  }
  for(const dates of [['2000-01-01','2000-01-01'],['2100-01-01','2100-01-02']]){
    await actor('postgres');await db.query("update company_ad_campaigns set status='approved',approved_start_date=$1,approved_end_date=$2 where id=$3",[...dates,id]);
    await actor();assert.equal((await projection()).metadata.some(b=>b.banner_key===`campaign:${id}`),false);
  }
  await actor('postgres');await db.query('update company_ad_campaigns set approved_start_date=$1,approved_end_date=$1,archived_at=now() where id=$2',[today,id]);
  await actor();assert.equal((await projection()).metadata.some(b=>b.banner_key===`campaign:${id}`),false);
  const missing=await campaign(false);await actor('postgres');await db.exec("delete from storage.objects where bucket_id='ad-media'");
  await actor();assert.equal((await projection()).metadata.some(b=>b.banner_key===`campaign:${missing}`),false);
});
test('public profile relationship never exposes draft profile IDs and public projection changes no booking state',async()=>{
  await campaign();await actor('postgres');await db.query("update company_profiles set status='draft' where id=$1",[ids[0]]);
  const before=(await db.query('select jsonb_agg(to_jsonb(t)) as rows from company_ad_campaign_targets t')).rows[0].rows;
  await actor();const result=await projection();assert.ok(result.metadata.every(b=>b.profile_id!==ids[0]));
  await actor('postgres');assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(t)) as rows from company_ad_campaign_targets t')).rows[0].rows,before);
});

test('public banner-only taxonomy labels remain usable without broadening travel_terms RLS',async()=>{
 const id=await campaign();await actor('authenticated',admin);await save(id,null,'QA','Ort',['audience:mit-hund']);
 await actor();assert.equal((await db.query("select * from travel_terms where term_key='audience:mit-hund'")).rows.length,0);
 const projected=(await projection()).terms;assert.ok(projected.some(t=>t.term_key==='audience:mit-hund'&&t.label==='Mit Hund'));
 assert.equal(projected.some(t=>t.term_key==='feature:unassigned'),false);
 await actor('postgres');await db.query("update company_ad_campaigns set status='paused' where id=$1",[id]);await actor();assert.equal((await projection()).terms.some(t=>t.term_key==='audience:mit-hund'),false);
});

async function assignment(id,extra={}) {
 return db.query('select save_ad_banner_search_assignment($1,NULL,$2,\'90001\',\'QA city\',$3,$4,$5,$6,$7,$8,$9,$10)',[id,'Public creative',extra.terms??['theme:wellnessangebote'],extra.key??null,extra.name??'QA advertiser',extra.profile??null,extra.commercial??true,extra.primary??false,extra.destinations??['oesterreich'],extra.region??'Tirol']);
}
test('admin explicit customer/geo assignment, public projection and non-admin denial',async()=>{
 const id=await campaign();await actor('authenticated',owner);await db.exec('savepoint denied');await assert.rejects(assignment(id),/Admin required/);await db.exec('rollback to denied');
 await actor('authenticated',admin);await assignment(id,{profile:ids[0]});await actor();
 const row=(await projection()).metadata.find(b=>b.banner_key===`campaign:${id}`);
 assert.equal(row.advertiser_key,`profile:${ids[0]}`);assert.deepEqual(row.destination_slugs,['oesterreich']);assert.equal(row.region,'Tirol');
 assert.equal((await db.query("select has_function_privilege('anon','save_ad_banner_search_assignment(uuid,text,text,text,text,text[],text,text,uuid,boolean,boolean,text[],text)','EXECUTE') AS allowed")).rows[0].allowed,false);
});
test('same-host legacy seeds grouped; cross-host misleading label never merged; no fabricated metadata',async()=>{
 await actor('postgres');const rows=(await db.query("select advertiser_key,destination_slugs,region,postal_code from ad_banner_search_metadata where banner_key like 'legacy:https://hoeflehner.com/%'")).rows;
 assert.equal(rows.length,4);assert.equal(new Set(rows.map(row=>row.advertiser_key)).size,1);assert.ok(rows.every(row=>row.destination_slugs.length===0&&row.region===''&&row.postal_code===''));
 const keys=(await db.query("select advertiser_key from ad_banner_search_metadata where banner_key IN ('legacy:https://hofmaran.ch/','legacy:https://josef.bz/de/hotel-hafling/1-0.html')")).rows;assert.equal(new Set(keys.map(row=>row.advertiser_key)).size,2);
});
test('unknown advertiser/profile/destination rejected atomically; no booking or creative change',async()=>{
 const id=await campaign();await actor('postgres');const before=(await db.query('select to_jsonb(c) AS row from company_ad_campaigns c where id=$1',[id])).rows[0].row;
 await actor('authenticated',admin);
 for(const extra of [{key:'invented'},{destinations:['invented']},{profile:crypto.randomUUID()}]){
  await db.exec('savepoint invalid');await assert.rejects(assignment(id,extra));await db.exec('rollback to invalid');
 }
 await assignment(id);await actor('postgres');const after=(await db.query('select to_jsonb(c) AS row from company_ad_campaigns c where id=$1',[id])).rows[0].row;
 for(const key of ['profile_id','target_url','image_path','approved_start_date','approved_end_date'])assert.deepEqual(after[key],before[key]);
});

test('archive reuse preserves customer and explicit search assignment, without copied booking',async()=>{
 const id=await campaign();await actor('authenticated',admin);await assignment(id,{destinations:['schweiz'],region:'Wallis'});
 await db.query("select admin_ad_lifecycle($1,'archive')",[id]);
 const copy=(await db.query("select admin_ad_lifecycle($1,'reuse') AS id",[id])).rows[0].id;
 await actor('postgres');const rows=(await db.query('select advertiser_key,destination_slugs,region from ad_banner_search_metadata where campaign_id IN ($1,$2) order by campaign_id',[id,copy])).rows;
 assert.deepEqual(rows[0],rows[1]);assert.equal((await db.query('select count(*)::int AS n from company_ad_campaign_targets where campaign_id=$1',[copy])).rows[0].n,0);
});
test('unapproved search profile identity is not exposed; creative replacement preserves assignment',async()=>{
 const id=await campaign();await actor('authenticated',admin);await assignment(id,{profile:ids[0]});await actor('postgres');
 const before=(await db.query('select to_jsonb(m) AS row from ad_banner_search_metadata m where campaign_id=$1',[id])).rows[0].row;
 const path=`campaigns/${id}/creative/${crypto.randomUUID()}.png`;await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)",[path]);await db.query('update company_ad_campaigns set image_path=$1 where id=$2',[path,id]);
 assert.deepEqual((await db.query('select to_jsonb(m) AS row from ad_banner_search_metadata m where campaign_id=$1',[id])).rows[0].row,before);
 await db.query("update company_profiles set status='draft' where id=$1",[ids[0]]);await actor();
 const row=(await projection()).metadata.find(b=>b.banner_key===`campaign:${id}`);assert.equal(row.profile_id,null);assert.equal(row.advertiser_key,null);
});


test('banner audience save/reopen/public projection preserves customer and unique terms',async()=>{
 const id=await campaign();await actor('authenticated',admin);
 await assignment(id,{terms:['audience:mit-hund','audience:familie','audience:paar','audience:mit-hund'],key:'domain:hoeflehner.com'});
 await actor();let row=(await projection()).metadata.find(b=>b.banner_key==='campaign:'+id);
 assert.deepEqual(row.term_keys,['audience:familie','audience:mit-hund','audience:paar']);
 assert.equal(row.advertiser_key,'domain:hoeflehner.com');
 await actor('authenticated',admin);await assignment(id,{terms:['audience:mit-hund'],key:'domain:hoeflehner.com'});
 await actor();row=(await projection()).metadata.find(b=>b.banner_key==='campaign:'+id);
 assert.deepEqual(row.term_keys,['audience:mit-hund']);assert.equal(row.advertiser_key,'domain:hoeflehner.com');
});

test('controlled banner audience seed adds only supported general creatives and is idempotent',async()=>{
 await actor('postgres');
 const seed=await readFile(new URL('../docs/reiseportal-banner-audience-assignments.sql',import.meta.url),'utf8');
 const sql=seed.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
 for(const [slug,terms] of [['anni-romantikhaeuschen',['paar']],['hoeflehner',['familie','mit-hund']],['feldhof-dolcevita-resort',['familie','mit-hund','paar']]]) {
  const profile=crypto.randomUUID();await db.query("insert into company_profiles(id,company_id,slug,display_name,status) values($1,$2,$3,$3,'approved')",[profile,owner,slug]);
  for(const term of terms)await db.query('insert into company_profile_travel_terms values($1,$2)',[profile,'audience:'+term]);
 }
 const before=(await db.query('select count(*)::int n from ad_banner_search_terms')).rows[0].n;
 await db.exec(sql);await db.exec(sql);
 assert.equal((await db.query('select count(*)::int n from ad_banner_search_terms')).rows[0].n,before+6);
 assert.equal((await db.query("select count(*)::int n from ad_banner_search_terms where banner_key like 'legacy:https://hoeflehner.com/%' and banner_key<>'legacy:https://hoeflehner.com/'")).rows[0].n,0);
});
