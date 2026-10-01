import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";
import './helpers/load-ts.mjs';

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const visitor = "44444444-4444-4444-8444-444444444444";
let db, today, baseline, securityBaseline;
const displayMigration = async () => db.exec((await readFile(new URL('../supabase/migrations/20261001170000_banner_display_order.sql', import.meta.url),'utf8')).replace(/^BEGIN;|^COMMIT;/gm,''));
const migration = async (name) => db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

async function actor(id = admin, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function denied(sql, params = [], pattern) {
  await db.exec("savepoint denied");
  await assert.rejects(db.query(sql, params), pattern);
  await db.exec("rollback to savepoint denied; release savepoint denied");
}
async function snapshot() {
  return {
    campaigns: await rows("select * from company_ad_campaigns order by id"),
    targets: await rows("select * from company_ad_campaign_targets order by campaign_id,placement"),
    objects: await rows("select * from storage.objects order by id"),
    buckets: await rows("select * from storage.buckets order by id"),
    companies: await rows("select * from companies order by id"),
    profiles: await rows("select * from company_profiles order by id"),
  };
}
async function securitySnapshot() {
  return {
    policies: await rows("select * from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname"),
    grants: await rows("select oid::regclass::text as name,relacl,relrowsecurity from pg_class where oid in ('company_ad_campaigns'::regclass,'company_ad_campaign_targets'::regclass,'storage.objects'::regclass) order by name"),
    functions: await rows("select proname,proacl,proconfig,prosecdef from pg_proc where proname in ('create_ad_campaign','create_admin_ad_campaign','save_ad_campaign','review_ad_campaign','can_access_ad_media','get_ad_slot_availability','get_active_ad_campaigns','ad_media_is_unreferenced') order by proname"),
    unchangedBodies: await rows("select proname,prosrc from pg_proc where proname in ('create_ad_campaign','create_admin_ad_campaign','review_ad_campaign','get_active_ad_campaigns','ad_media_is_unreferenced') order by proname"),
  };
}

before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create table auth.users(id uuid primary key)");
  await db.query("insert into auth.users values($1),($2),($3),($4)", [owner, other, admin, visitor]);
  await db.query("insert into portal_admins values($1)", [admin]);
  for (const id of [owner, other]) {
    await db.query("insert into companies values($1,$1,'Firma')", [id]);
    await db.query("insert into company_profiles(id,company_id,display_name,status) values($1,$1,'Firma','draft')", [id]);
    await db.query("insert into company_profile_categories(profile_id,category_id) values($1,'solar')", [id]);
  }
  for (const file of [
    "20260917203041_company_ad_campaigns.sql",
    "20260918202110_company_ad_campaign_targets.sql",
    "20260925091403_company_directory_order.sql",
    "20260925103400_directory_demo_and_sidebar_order.sql",
    "20260925160039_expand_legacy_advertising_rail.sql",
    "20260930120000_ad_target_placements.sql",
  ]) await migration(file);
  await db.exec("create table public.travel_terms(dimension text not null,slug text not null)");
  await db.exec("insert into travel_terms values ('theme','wellnessangebote'),('theme','wanderurlaub')");
  await migration("20260930143000_portal_ad_target_areas.sql");
  today = (await rows("select ((now() at time zone 'Europe/Berlin')::date)::text as day"))[0].day;
  for (const [index, status] of ["draft", "pending", "approved", "paused", "rejected"].entries()) {
    const id = crypto.randomUUID(), image = `campaigns/${id}/creative/${crypto.randomUUID()}.png`;
    await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)", [image]);
    await db.query(`insert into company_ad_campaigns(id,profile_id,internal_name,headline,target_url,image_path,status,
      requested_start_date,requested_end_date,approved_start_date,approved_end_date,submitted_at,reviewed_at,reviewed_by,admin_note)
      values($1,$2,'Bestand','Original','https://example.org',$3,$4,'2030-01-01','2030-01-31','2030-01-01','2030-01-31',now(),now(),$5,'Unverändert')`,
    [id, owner, image, status, admin]);
    await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'homepage',$2)",
      [id, ["top_banner", "sidebar_top", "sidebar_middle", "sidebar_bottom", "sidebar_04"][index]]);
  }
  baseline = await snapshot();
  securityBaseline = await securitySnapshot();
  await migration("20260930170000_editorial_ad_campaigns.sql");
  baseline = await snapshot(); securityBaseline = await securitySnapshot();
  await migration("20260930190000_inline_banner_presentation.sql");
  await migration("20261001090000_fixed_banner_slot_contents.sql");
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));

test('restore only proven A–Z visibility, retaining content/display order, other pages and booking/security; admin reorder persists',async()=>{
 await displayMigration(); await actor(admin,'postgres');
 for(const [i,placement] of ['top_banner',...fixedSlots].entries()){
  const source=i===2?fixedSlots[3]:i===3?fixedSlots[1]:i===4?fixedSlots[2]:i===0?null:placement;
  await db.query("insert into ad_slot_presentations(target_type,placement,size,legacy_hidden,legacy_placement) values('experts_directory',$1,$2,$3,$4)",[placement,i>=2&&i<=4?'large':'small',i!==2,source]);
 }
 await db.exec("insert into ad_slot_presentations(target_type,placement,size,legacy_hidden) values('homepage','sidebar_top','medium',true)");
 const before=await rows('select * from ad_slot_presentations order by target_type,placement'),data=await snapshot(),security=await securitySnapshot();
 const sql=(await readFile(new URL('../supabase/migrations/20261001213000_restore_directory_legacy_banners.sql',import.meta.url),'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');
 await db.exec(sql); const restored=await rows('select * from ad_slot_presentations order by target_type,placement');
 assert.deepEqual(restored,before.map(row=>({...row,legacy_hidden:row.target_type==='experts_directory'&&fixedSlots.slice(0,10).includes(row.legacy_placement)?false:row.legacy_hidden})));
 await db.exec(sql);assert.deepEqual(await rows('select * from ad_slot_presentations order by target_type,placement'),restored);
 assert.deepEqual(await snapshot(),data);assert.deepEqual(await securitySnapshot(),security);
 const tokens=fixedSlots.map((slot,i)=>i<10?'legacy:'+(i===1?fixedSlots[3]:i===2?fixedSlots[1]:i===3?fixedSlots[2]:slot):'');
 for(const [id,role] of [['','anon'],[owner,'authenticated']]){await actor(id,role);await denied(reorderSql,[cToA,tokens],/not authorized|permission denied/);}
 await actor();await rows(reorderSql,[cToA,tokens]);
 await actor('','anon');const loaded=await rows("select * from ad_slot_presentations where target_type='experts_directory' order by placement");
 assert.equal(loaded.find(row=>row.placement===fixedSlots[0]).display_source,fixedSlots[2]);
 const {presentedBanners}=await import('../src/lib/banner-presentation.ts');
 const visible=presentedBanners([],loaded,'/unterkuenfte-a-z').filter(b=>!b.suppressed);
 assert.equal(visible.length,10);assert.equal(visible[0].id,'haus-salzburg');
 assert.deepEqual(visible.map(b=>b.placement),fixedSlots.slice(0,10));
 await actor(admin,'postgres');assert.deepEqual(await snapshot(),data);assert.deepEqual(await securitySnapshot(),security);
 assert.deepEqual(await rows("select * from ad_slot_presentations where target_type='homepage' order by placement"),before.filter(row=>row.target_type==='homepage'));
});

test('display migration preserves inventory, booking functions and permissions; only admin can reorder',async()=>{
 const before=await snapshot(),security=await securitySnapshot();
 await displayMigration();
 assert.deepEqual(await snapshot(),before);assert.deepEqual(await securitySnapshot(),security);
 for(const [id,role] of [['','anon'],[owner,'authenticated'],[other,'authenticated'],[visitor,'authenticated']]){
  await actor(id,role);await denied(reorderSql,[cToA,legacyTokens],/not authorized|permission denied/);
  await denied("update ad_slot_presentations set display_source='sidebar_bottom'",[],/permission denied/);
 }
 await actor();await rows(reorderSql,[cToA,legacyTokens]);
 await actor('', 'anon');assert.equal((await rows("select display_source from ad_slot_presentations where placement='sidebar_top'"))[0].display_source,'sidebar_bottom');
});

test('company/shared display reorder and reload leave booking targets, campaigns, availability and other pages byte-identical',async()=>{
 await displayMigration();await actor(admin,'postgres');
 const campaign=baseline.campaigns.find(row=>row.status==='approved');
 await db.query("update company_ad_campaigns set approved_start_date=$1,approved_end_date=$1 where id=$2",[today,campaign.id]);
 await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'experts_directory','sidebar_bottom')",[campaign.id]);
 await db.query("insert into ad_slot_presentations(target_type,target_key,placement,size,legacy_hidden) values('homepage',null,'top_banner','small',true),('experts_directory',null,'sidebar_bottom','medium',true)");
 const unchanged=await snapshot(), premium=await rows("select * from ad_slot_presentations where placement='top_banner'");
 await actor();const availability=await rows("select * from get_ad_slot_availability($1,$1,null) order by target_type,placement",[today]);
 const home=await rows("select * from get_active_ad_campaigns('homepage',null)");
 const expected=[...legacyTokens];expected[2]=campaign.id;
 await rows(reorderSql,[cToA,expected]);
 assert.deepEqual(await inventory(),unchanged);
 assert.deepEqual(await rows("select * from get_ad_slot_availability($1,$1,null) order by target_type,placement",[today]),availability);
 assert.deepEqual(await rows("select * from get_active_ad_campaigns('homepage',null)"),home);
 assert.equal((await rows("select * from get_active_ad_campaigns('experts_directory',null)"))[0].placement,'sidebar_bottom');
 const persisted=await rows("select placement,display_source from ad_slot_presentations where target_type='experts_directory' order by placement");
 assert.equal(persisted.find(row=>row.placement==='sidebar_top').display_source,'sidebar_bottom');
 assert.deepEqual(await rows("select * from ad_slot_presentations where placement='top_banner'"),premium);
 // Compose a second display move using visible-slot tokens, not booking targets.
 const inverse=[fixedSlots[1],fixedSlots[2],fixedSlots[0],...fixedSlots.slice(3)];
 const newTokens=[campaign.id,legacyTokens[0],legacyTokens[1],...legacyTokens.slice(3)];
 await denied(reorderSql,[inverse,expected],/banner changed/);
 await rows(reorderSql,[inverse,newTokens]);
 assert.deepEqual(await inventory(),unchanged);
 const reset=await rows("select placement,display_source from ad_slot_presentations where target_type='experts_directory'");
 assert.ok(reset.every(row=>row.placement===row.display_source));
 await denied(reorderSql,[[...fixedSlots.slice(0,11),'top_banner'],expected],/invalid contents/);
});

test('future company bookings do not block display movement and remain untouched',async()=>{
 await displayMigration();await actor(admin,'postgres');
 const campaign=baseline.campaigns.find(row=>row.status==='approved');
 await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'experts_directory','sidebar_bottom')",[campaign.id]);
 const before=await snapshot();await actor();await rows(reorderSql,[cToA,legacyTokens]);
 assert.deepEqual(await inventory(),before);
});

async function create(targetType = "homepage", targetKey = null, placement = "top_banner") {
  await actor();
  const id = (await rows("select create_editorial_ad_campaign($1,$2,$3) as id", [targetType, targetKey, placement]))[0].id;
  return { id, targets: [{ target_type: targetType, category_id: null, target_key: targetKey, placement }] };
}
async function upload(id) {
  const image = `campaigns/${id}/creative/${crypto.randomUUID()}.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)", [image]);
  return image;
}
async function save(campaign, overrides = {}, submit = true) {
  await actor();
  const image = overrides.image_path ?? await upload(campaign.id);
  const data = {
    internal_name: "Portal-Banner", headline: "Anzeige", target_url: "https://example.org/urlaub",
    image_path: image, targets: campaign.targets, requested_start_date: today, requested_end_date: today, ...overrides,
  };
  await db.query("select save_ad_campaign($1,$2,$3)", [campaign.id, data, submit]);
  return data;
}
async function approve(id) {
  await actor();
  await db.query("select review_ad_campaign($1,'approve',$2,$2,null)", [id, today]);
}
async function publicAds(scope = "homepage", key = null) {
  await actor("", "anon");
  return rows("select * from get_active_ad_campaigns($1,$2)", [scope, key]);
}

const presentation = (campaign, size = "medium", hidden = true, key = null, placement = "top_banner", type = "homepage") =>
  rows("select save_inline_ad_presentation($1,$2,$3,$4,$5,$6,null)", [type,key,placement,campaign,size,hidden]);
const remove = (id, full = false, key = null, placement = "top_banner", type = "homepage") =>
  rows("select remove_inline_ad_banner($1,$2,$3,$4,$5) as image", [id,type,key,placement,full]);
const fixedSlots = ["sidebar_top","sidebar_middle","sidebar_bottom",...Array.from({length:9},(_,i)=>`sidebar_${String(i+4).padStart(2,"0")}`)];
const legacyTokens = fixedSlots.map((slot,i)=>i<10?`legacy:${slot}`:"");
const cToA = [fixedSlots[2],fixedSlots[0],fixedSlots[1],...fixedSlots.slice(3)];
const reorderSql = "select reorder_inline_ad_contents('experts_directory',null,$1::text[],$2::text[])";
async function inventory() { await actor(admin,"postgres"); const state=await snapshot(); await actor(); return state; }

test("fixed-slot reorder is additive and only actual admins may invoke it", async () => {
  assert.equal((await rows("select has_function_privilege('anon','reorder_inline_ad_contents(text,text,text[],text[])','EXECUTE') as allowed"))[0].allowed,false);
  for (const [id,role] of [["","anon"],[owner,"authenticated"],[other,"authenticated"]]) {
    await actor(id,role); await denied(reorderSql,[cToA,legacyTokens],/not authorized|permission denied/);
  }
  await actor();
  for (const bad of [fixedSlots.slice(1),[fixedSlots[0],...fixedSlots.slice(0,-1)],['top_banner',...fixedSlots.slice(1)]])
    await denied(reorderSql,[bad,legacyTokens],/invalid contents/);
  await denied(reorderSql,[cToA,legacyTokens.map(()=>"forged")],/banner changed/);
  assert.deepEqual(await inventory(),baseline);
});

test("C content becomes A; campaign target, URL, size and media reference move atomically and reload correctly", async () => {
  const c = await create("experts_directory",null,"sidebar_bottom");
  const data = await save(c); await approve(c.id); await actor();
  await presentation(c.id,"small",true,null,"sidebar_bottom","experts_directory");
  const objects = await rows("select * from storage.objects order by id");
  const expected = [...legacyTokens]; expected[2]=c.id;
  await db.query(reorderSql,[cToA,expected]);
  const [target] = await rows("select placement from company_ad_campaign_targets where campaign_id=$1",[c.id]);
  assert.equal(target.placement,"sidebar_top");
  const [live] = await publicAds("experts_directory");
  assert.equal(live.id,c.id); assert.equal(live.placement,"sidebar_top");
  assert.equal(live.image_path,data.image_path); assert.equal(live.target_url,data.target_url);
  await actor();
  const settings = await rows("select placement,size,legacy_hidden,legacy_placement from ad_slot_presentations order by placement");
  assert.equal(settings.find(x=>x.placement==="sidebar_top").size,"small");
  assert.equal(settings.find(x=>x.placement==="sidebar_middle").legacy_placement,"sidebar_top");
  assert.equal(settings.find(x=>x.placement==="sidebar_bottom").legacy_placement,"sidebar_middle");
  assert.deepEqual(await rows("select * from storage.objects order by id"),objects);
  // The existing remove/upload/URL/size routines now bind to A, never the former C.
  await denied("select remove_inline_ad_banner($1,'experts_directory',null,'sidebar_bottom',true)",[c.id],/wrong banner context/);
  await remove(c.id,true,null,"sidebar_top","experts_directory");
  assert.equal((await publicAds("experts_directory")).length,0);
  await actor(); assert.equal((await rows("select legacy_hidden from ad_slot_presentations where placement='sidebar_top'"))[0].legacy_hidden,true);
  assert.deepEqual(await rows("select * from storage.objects order by id"),objects);
});

test("Legacy URL/size follow only their content; empty content remains empty and other pages/Premium unchanged", async () => {
  await actor(); await presentation(null,"medium",false,null,"sidebar_bottom","experts_directory");
  await db.query("select save_inline_ad_presentation('experts_directory',null,'sidebar_bottom',null,'medium',false,'https://example.org/legacy')");
  await presentation(null,"small",false,null,"top_banner","experts_directory");
  const unchanged = await inventory();
  await db.query(reorderSql,[cToA,legacyTokens]);
  const [a] = await rows("select * from ad_slot_presentations where placement='sidebar_top'");
  assert.equal(a.legacy_placement,"sidebar_bottom"); assert.equal(a.size,"medium"); assert.equal(a.legacy_target_url,"https://example.org/legacy");
  assert.equal((await rows("select size from ad_slot_presentations where placement='top_banner'"))[0].size,"small");
  assert.deepEqual(await inventory(),unchanged);
  assert.equal((await rows("select count(*)::int n from ad_slot_presentations where target_type='homepage'"))[0].n,0);
  // Reject an old browser permutation after the first save.
  await denied(reorderSql,[cToA,legacyTokens],/banner changed/);
  const tokens=[`legacy:${fixedSlots[2]}`,`legacy:${fixedSlots[0]}`,`legacy:${fixedSlots[1]}`,...legacyTokens.slice(3)];
  const lToA=[fixedSlots[11],...fixedSlots.slice(0,11)];
  await db.query(reorderSql,[lToA,tokens]);
  assert.equal((await rows("select legacy_placement from ad_slot_presentations where placement='sidebar_top'"))[0].legacy_placement,"sidebar_12");
});

test("future company bookings and shared campaigns cannot be moved, with complete rollback", async () => {
  const c = await create("experts_directory",null,"sidebar_bottom"); await save(c); await approve(c.id);
  await actor(admin,"postgres");
  await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'homepage','sidebar_12')",[c.id]);
  const original = await snapshot(); await actor();
  const expected=[...legacyTokens];expected[2]=c.id;
  await denied(reorderSql,[cToA,expected],/shared banner/); assert.deepEqual(await inventory(),original);
  await actor(admin,"postgres");
  const company = baseline.campaigns.find(x=>x.status==='approved');
  await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'experts_directory','sidebar_top')",[company.id]);
  const protectedState=await snapshot();await actor();
  await denied(reorderSql,[cToA,expected],/company or shared banner/);assert.deepEqual(await inventory(),protectedState);
});

test("presentation migration rewrites no inventory or existing RPC, policy or grant", async () => {
  assert.deepEqual(await snapshot(), baseline);
  const current = await securitySnapshot();
  current.policies = current.policies.filter((row) => row.tablename !== "ad_slot_presentations");
  assert.deepEqual(current, securityBaseline);
  assert.deepEqual(await rows("select * from ad_slot_presentations"), []);
});

test("anon and ordinary users may read only public presentation; cannot write or execute admin actions", async () => {
  for (const [id,role] of [["","anon"],[owner,"authenticated"],[other,"authenticated"]]) {
    await actor(id,role);
    assert.deepEqual(await rows("select * from ad_slot_presentations"), []);
    await denied("insert into ad_slot_presentations(target_type,placement) values('homepage','top_banner')", [], /permission denied/);
    await denied("select save_inline_ad_presentation('homepage',null,'top_banner',null,'small',true,null)", [], /not authorized|permission denied/);
    await denied("select remove_inline_ad_banner($1,'homepage',null,'top_banner',true)", [baseline.campaigns[0].id], /not authorized|permission denied/);
  }
});

test("all controlled sizes and exact subrubrics are independent, with unique NULL-aware identities", async () => {
  await actor();
  for (const size of ["small","medium","large"]) await presentation(null,size,false,"mottoreisen/wellnessangebote","sidebar_top","portal_area");
  await presentation(null,"small",true,"mottoreisen/wanderurlaub","sidebar_top","portal_area");
  await presentation(null,"small",true); await presentation(null,"large",true);
  const state = await rows("select target_key,size,legacy_hidden from ad_slot_presentations order by target_key nulls last");
  assert.equal(state.length,3); assert.deepEqual(state.map((row) => row.size), ["small","large","large"]);
  await denied("select save_inline_ad_presentation('homepage',null,'top_banner',null,'999px',true,null)", [], /check constraint/);
  await denied("select save_inline_ad_presentation('portal_area','fake','top_banner',null,'small',true,null)", [], /foreign key/);
});

test("image removal turns only this editorial banner into a draft, retaining slot and permitting protected cleanup", async () => {
  const c = await create(); const data = await save(c); await approve(c.id);
  await actor(); const [result] = await remove(c.id);
  assert.equal(result.image,data.image_path);
  assert.equal((await rows("select status,image_path,target_url from company_ad_campaigns where id=$1", [c.id]))[0].status,"draft");
  assert.equal((await rows("select count(*)::int as n from company_ad_campaign_targets where campaign_id=$1",[c.id]))[0].n,1);
  assert.equal((await rows("select ad_media_is_unreferenced($1) as free,can_access_ad_media($1,true) as allowed",[data.image_path]))[0].free,true);
  assert.equal((await rows("select can_access_ad_media($1,true) as allowed",[data.image_path]))[0].allowed,true);
  assert.equal((await publicAds()).some((row) => row.id===c.id),false);
  // Re-add using the existing save/review and immutable-upload path model.
  await save(c); await approve(c.id);
  assert.equal((await publicAds()).some((row) => row.id===c.id),true);
});

test("banner deletion frees exact target, keeps history, creates no Storage copy, and permits a fresh booking", async () => {
  const c = await create(); await save(c); await approve(c.id);
  await actor(); const beforeObjects = await rows("select * from storage.objects order by id");
  await remove(c.id,true);
  assert.deepEqual(await rows("select * from storage.objects order by id"),beforeObjects);
  assert.equal((await rows("select count(*)::int as n from company_ad_campaign_targets where campaign_id=$1",[c.id]))[0].n,0);
  assert.equal((await rows("select count(*)::int as n from company_ad_campaigns where id=$1",[c.id]))[0].n,1);
  assert.equal((await rows("select * from get_ad_slot_availability($1,$1,null)",[today])).some((row) => row.target_type==="homepage"&&row.placement==="top_banner"),false);
  const next = await create(); await save(next); await approve(next.id);
  const visible = await publicAds(); assert.equal(visible.filter((row) => row.placement==="top_banner").length,1);
  assert.equal(visible[0].id,next.id);
});

test("wrong page/place, company campaigns, shared campaigns and stale legacy mutations are rejected", async () => {
  const c = await create(); await save(c); await approve(c.id); await actor();
  await denied("select remove_inline_ad_banner($1,'experts_directory',null,'top_banner',true)",[c.id],/wrong banner context/);
  await denied("select remove_inline_ad_banner($1,'homepage',null,'sidebar_top',true)",[c.id],/wrong banner context/);
  await denied("select remove_inline_ad_banner($1,'homepage',null,$2,true)",[baseline.campaigns[0].id,baseline.targets.find((t)=>t.campaign_id===baseline.campaigns[0].id).placement],/wrong banner context/);
  await denied("select save_inline_ad_presentation('homepage',null,'top_banner',null,'small',true,null)",[],/banner changed/);
  await actor(admin,"postgres");
  await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'experts_directory','sidebar_top')",[c.id]);
  await actor(); await denied("select remove_inline_ad_banner($1,'homepage',null,'top_banner',true)",[c.id],/wrong banner context/);
  assert.equal((await rows("select status from company_ad_campaigns where id=$1",[c.id]))[0].status,"approved");
});

test('reconciled defaults are additive/idempotent, preserve editorial state and security; empty slots reorder without phantom content',async()=>{
 const {legacyBannerPages}=await import('../src/data/legacy-banner-pages.ts');
 await actor(admin,'postgres');
 for(const path of Object.keys(legacyBannerPages).filter(x=>x.startsWith('/mottoreisen')||x.startsWith('/reiseziele'))){const [section,slug]=path.slice(1).split('/');await db.query('insert into ad_portal_areas values($1,$2,$3) on conflict do nothing',[path.slice(1),section,slug??null]);}
 await db.exec("insert into ad_slot_presentations(target_type,target_key,placement,size,legacy_hidden,legacy_target_url,legacy_placement) values('homepage',null,'sidebar_middle','medium',true,'https://example.org/custom','sidebar_bottom')");
 const original=(await rows("select * from ad_slot_presentations where target_type='homepage'"))[0];const dataBefore=await snapshot(),securityBefore=await securitySnapshot();
 const sql=(await readFile(new URL('../supabase/migrations/20261001120000_reconciled_banner_defaults.sql',import.meta.url),'utf8')).replace(/\bBEGIN;|\bCOMMIT;/g,'');
 await db.exec(sql);await db.exec(sql);
 assert.equal((await rows('select count(*)::int as n from ad_slot_presentations'))[0].n,260);
 assert.deepEqual((await rows("select * from ad_slot_presentations where target_type='homepage' and placement='sidebar_middle'"))[0],original);
 assert.deepEqual(await snapshot(),dataBefore);assert.deepEqual(await securitySnapshot(),securityBefore);
 assert.equal((await rows("select count(*)::int as n from ad_slot_presentations where target_type='experts_directory' and legacy_hidden"))[0].n,13);
 await actor('','anon');assert.equal((await rows('select count(*)::int as n from ad_slot_presentations'))[0].n,260);await denied("update ad_slot_presentations set legacy_hidden=false",[],/permission denied/);
 await actor(visitor);await denied("select save_inline_ad_presentation('homepage',null,'sidebar_top',null,'small',true,null)",[],/not authorized/);
 const positions=['sidebar_top','sidebar_middle','sidebar_bottom',...Array.from({length:9},(_,i)=>'sidebar_'+String(i+4).padStart(2,'0'))];
 await actor();const sources=[positions[1],positions[0],...positions.slice(2)];await rows("select reorder_inline_ad_contents('experts_directory',null,$1,$2)",[sources,Array(12).fill('')]);
 assert.equal((await rows("select count(*)::int as n from ad_slot_presentations where target_type='experts_directory' and not legacy_hidden"))[0].n,0);
 const otherPagesBefore=await rows("select * from ad_slot_presentations where target_key is distinct from 'mottoreisen/natur-pur' or placement='top_banner' order by target_type,target_key,placement");
 const natureSources=[positions[2],positions[0],positions[1],...positions.slice(3)];const expected=positions.map((p,i)=>i<9?'legacy:'+p:'');
 await rows("select reorder_inline_ad_contents('portal_area','mottoreisen/natur-pur',$1,$2)",[natureSources,expected]);
 assert.equal((await rows("select legacy_placement from ad_slot_presentations where target_key='mottoreisen/natur-pur' and placement='sidebar_top'"))[0].legacy_placement,'sidebar_bottom');
 assert.deepEqual(await rows("select * from ad_slot_presentations where target_key is distinct from 'mottoreisen/natur-pur' or placement='top_banner' order by target_type,target_key,placement"),otherPagesBefore);
});
