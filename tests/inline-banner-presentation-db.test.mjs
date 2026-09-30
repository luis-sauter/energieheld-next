import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const visitor = "44444444-4444-4444-8444-444444444444";
let db, today, baseline, securityBaseline;
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
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));

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
