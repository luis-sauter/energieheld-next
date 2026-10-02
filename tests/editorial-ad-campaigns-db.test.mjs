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
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));

test("verified Reiseziele seed adds one profile-free editable editorial campaign and changes no existing data/security", async () => {
  const id = '7f1c06f6-9946-4f0e-90bc-7fb9499ed010';
  const image = `campaigns/${id}/creative/ee4dcb6a-2ccc-4c4a-9a83-9d278a80d010.webp`;
  const sql = (await readFile(new URL('../supabase/migrations/20261002090000_seed_reiseziele_editorial_promo.sql', import.meta.url),'utf8')).replace(/^BEGIN;|^COMMIT;/gm,'');
  const before = await snapshot(), rights = await securitySnapshot();
  await denied(sql, [], /Upload the verified editorial creative first/);
  await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)",[image]);
  await db.exec(sql);
  const after = await snapshot();
  const [campaign] = after.campaigns.filter(row => row.id === id);
  assert.equal(campaign.profile_id, null);
  assert.equal(campaign.is_editorial, true);
  assert.equal(campaign.status, 'approved');
  assert.equal(campaign.image_path, image);
  assert.equal(after.targets.filter(row => row.campaign_id === id).length, 1);
  after.campaigns = after.campaigns.filter(row => row.id !== id);
  after.targets = after.targets.filter(row => row.campaign_id !== id);
  after.objects = after.objects.filter(row => row.name !== image);
  assert.deepEqual(after, before);
  assert.deepEqual(await securitySnapshot(), rights);
  await denied(sql, [], /already exists/);
  assert.equal((await publicAds('portal_area','reiseziele')).filter(row => row.id === id).length, 1);
  await actor(visitor);
  assert.equal((await rows('select id from company_ad_campaigns where id=$1',[id])).length, 0);
  await denied("select save_ad_campaign($1,'{}'::jsonb,false)",[id],/not editable/);
  await actor();
  assert.equal((await rows('select id from company_ad_campaigns where id=$1',[id])).length, 1);
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

test("editorial migration preserves all company campaign statuses, targets, profiles and objects exactly", async () => {
  const after = await snapshot();
  for (const row of after.campaigns) assert.equal(row.is_editorial, false);
  after.campaigns = after.campaigns.map((row) => {
    const original = { ...row };
    delete original.is_editorial;
    return original;
  });
  assert.deepEqual(after, baseline);
  assert.deepEqual(await securitySnapshot(), securityBaseline, "table grants, RLS/Storage policies and existing RPC grants remain unchanged");
});

test("only real portal admins can create an editorial draft without inventing a company or owner", async () => {
  for (const [id, role] of [["", "anon"], [owner, "authenticated"], [visitor, "authenticated"], ["", "authenticated"]]) {
    await actor(id, role);
    await denied("select create_editorial_ad_campaign('homepage')", [], /permission denied|not authorized/);
  }
  const c = await create("portal_area", "mottoreisen/wellnessangebote", "sidebar_top");
  const [row] = await rows("select * from company_ad_campaigns where id=$1", [c.id]);
  assert.equal(row.profile_id, null);
  assert.equal(row.is_editorial, true);
  assert.equal(row.status, "draft");
  assert.equal(row.requested_start_date.toISOString().slice(0, 10), today);
  assert.equal(row.requested_end_date.toISOString().slice(0, 10), today);
  assert.equal(row.image_path, null);
  assert.deepEqual(await rows("select target_type,target_key,placement from company_ad_campaign_targets where campaign_id=$1", [c.id]),
    [{ target_type: "portal_area", target_key: "mottoreisen/wellnessangebote", placement: "sidebar_top" }]);
  await actor(admin, "postgres");
  assert.deepEqual(await rows("select * from companies order by id"), baseline.companies);
  assert.deepEqual(await rows("select * from company_profiles order by id"), baseline.profiles);
  assert.equal((await rows("select count(*)::int as n from auth.users"))[0].n, 4);
});

test("editorial profile binding is explicit and cannot turn an existing company campaign into an unbound campaign", async () => {
  await actor(admin, "postgres");
  await denied("insert into company_ad_campaigns(profile_id) values(null)", [], /ad_campaign_profile_binding/);
  await denied("insert into company_ad_campaigns(profile_id,is_editorial) values($1,true)", [owner], /ad_campaign_profile_binding/);
  await denied("update company_ad_campaigns set profile_id=null where id=$1", [baseline.campaigns[0].id], /ad_campaign_profile_binding/);
  const c = await create();
  const data = await save(c, { profile_id: owner, is_editorial: false, status: "approved", reviewed_by: owner }, false);
  const [row] = await rows("select profile_id,is_editorial,status,reviewed_by from company_ad_campaigns where id=$1", [c.id]);
  assert.deepEqual(row, { profile_id: null, is_editorial: true, status: "draft", reviewed_by: null });
  assert.equal(data.profile_id, owner, "forged ownership is ignored by the existing whitelist RPC");
  await actor();
  await denied("select create_admin_ad_campaign(null)", [], /profile not found/);
});

test("editorial create validates only actual portal contexts and all thirteen existing placements atomically", async () => {
  await actor();
  const count = (await rows("select count(*)::int as n from company_ad_campaigns"))[0].n;
  for (const args of [
    [null, null, "top_banner"], ["trade", "solar", "top_banner"], ["invented", null, "top_banner"],
    ["homepage", "mottoreisen", "top_banner"], ["experts_directory", "", "top_banner"],
    ["portal_area", null, "top_banner"], ["portal_area", "mottoreisen/fake", "top_banner"],
    ["homepage", null, null], ["homepage", null, "sidebar_13"],
  ]) await denied("select create_editorial_ad_campaign($1,$2,$3)", args, /invalid_ad_targets|invalid placement/);
  assert.equal((await rows("select count(*)::int as n from company_ad_campaigns"))[0].n, count);
  for (const slot of ["top_banner", "sidebar_top", "sidebar_middle", "sidebar_bottom", ...Array.from({ length: 9 }, (_, i) => `sidebar_${String(i + 4).padStart(2, "0")}`)]) {
    const c = await create("homepage", null, slot);
    assert.equal((await rows("select placement from company_ad_campaign_targets where campaign_id=$1", [c.id]))[0].placement, slot);
  }
});

test("editorial campaigns and targets are admin-only; owners, foreign users and anon cannot mutate them", async () => {
  const c = await create(), data = await save(c, {}, false);
  for (const id of [owner, other, visitor]) {
    await actor(id);
    assert.deepEqual(await rows("select id from company_ad_campaigns where id=$1", [c.id]), []);
    assert.deepEqual(await rows("select * from company_ad_campaign_targets where campaign_id=$1", [c.id]), []);
    await denied("select save_ad_campaign($1,$2,false)", [c.id, data], /not editable/);
    await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [c.id, today], /not authorized/);
  }
  for (const role of ["authenticated", "anon"]) {
    await actor(role === "anon" ? "" : admin, role);
    for (const sql of [
      "insert into company_ad_campaigns(is_editorial) values(true)",
      "update company_ad_campaigns set is_editorial=true",
      "delete from company_ad_campaigns",
      "insert into company_ad_campaign_targets(campaign_id,target_type) values($1,'homepage')",
      "update company_ad_campaign_targets set placement='sidebar_top'",
      "delete from company_ad_campaign_targets",
    ]) await denied(sql, sql.includes("$1") ? [c.id] : [], /permission denied/);
  }
  await actor("", "anon");
  await denied("select * from company_ad_campaigns", [], /permission denied/);
  await denied("select save_ad_campaign($1,$2,false)", [c.id, data], /permission denied/);
  await actor();
  assert.equal((await rows("select id from company_ad_campaigns where id=$1", [c.id]))[0].id, c.id);
});

test("private editorial media reuse existing upload, replacement and unreferenced cleanup policies", async () => {
  const c = await create(), data = await save(c);
  for (const id of [owner, other, visitor, ""]) {
    await actor(id, id ? "authenticated" : "anon");
    assert.deepEqual(await rows("select name from storage.objects where name=$1", [data.image_path]), []);
    assert.equal((await rows("select can_access_ad_media($1,true) as allowed", [data.image_path]))[0].allowed, false);
    if (id) await denied("insert into storage.objects(bucket_id,name) values('ad-media',$1)",
      [`campaigns/${c.id}/creative/${crypto.randomUUID()}.png`], /row-level security/);
  }
  await approve(c.id);
  await actor("", "anon");
  assert.deepEqual(await rows("select name from storage.objects where name=$1", [data.image_path]), [{ name: data.image_path }]);
  await actor();
  const replacement = await upload(c.id);
  assert.equal((await rows("update storage.objects set name=name where name=$1 returning name", [data.image_path])).length, 0, "no UPDATE policy or upsert introduced");
  assert.equal((await rows("delete from storage.objects where name=$1 returning name", [data.image_path])).length, 0, "referenced media cannot be deleted");
  const before = (await rows("select count(*)::int as n from storage.objects where bucket_id='ad-media'"))[0].n;
  await save(c, { ...data, image_path: replacement }, false);
  assert.equal((await rows("select count(*)::int as n from storage.objects where bucket_id='ad-media'"))[0].n, before, "save does not duplicate Storage objects");
  assert.equal((await rows("delete from storage.objects where name=$1 returning name", [data.image_path])).length, 1);
  await actor("", "anon");
  assert.deepEqual(await rows("select name from storage.objects where name=$1", [data.image_path]), []);
  assert.deepEqual(await rows("select name from storage.objects where name=$1", [replacement]), [{ name: replacement }]);
});

test("editorial save rejects invalid URLs, missing images, foreign media and energy trade targets", async () => {
  const c = await create(), foreign = await create("experts_directory"), data = await save(c, {}, false);
  const foreignImage = await upload(foreign.id);
  for (const override of [
    { target_url: "javascript:alert(1)" }, { target_url: "https://user:pass@example.org" },
    { image_path: foreignImage }, { image_path: `campaigns/${c.id}/creative/${crypto.randomUUID()}.png` },
    { targets: [{ target_type: "trade", category_id: "solar", placement: "top_banner" }] },
    { targets: [c.targets[0], c.targets[0]] },
  ]) await denied("select save_ad_campaign($1,$2,false)", [c.id, { ...data, ...override }]);
  await db.query("select save_ad_campaign($1,$2,true)", [c.id, { ...data, image_path: null }]);
  await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [c.id, today], /image required/);
  assert.deepEqual(await rows("select target_type,target_key,placement from company_ad_campaign_targets where campaign_id=$1", [c.id]),
    [{ target_type: "homepage", target_key: null, placement: "top_banner" }]);
});

test("editorial publication uses the existing lifecycle and exact public context for all portal page types", async () => {
  for (const [type, key, slot] of [
    ["homepage", null, "top_banner"], ["experts_directory", null, "sidebar_top"],
    ["portal_area", "mottoreisen", "sidebar_top"], ["portal_area", "mottoreisen/wellnessangebote", "top_banner"],
    ["portal_area", "reiseziele", "sidebar_top"], ["portal_area", "reiseziele/deutschland", "sidebar_middle"],
  ]) {
    const c = await create(type, key, slot), data = await save(c);
    assert.deepEqual(await publicAds(type, key), [], "pending editorial banners are not public");
    await approve(c.id);
    assert.deepEqual(await publicAds(type, key), [{
      id: c.id, placement: slot, headline: data.headline, body_text: null, target_url: data.target_url, image_path: data.image_path,
    }]);
    await actor();
    await db.query("select review_ad_campaign($1,'pause',null,null,null)", [c.id]);
    assert.deepEqual(await publicAds(type, key), []);
    await actor();
    await db.query("select review_ad_campaign($1,'resume',null,null,null)", [c.id]);
    assert.equal((await publicAds(type, key))[0].id, c.id);
  }
  assert.deepEqual(await publicAds("portal_area", "mottoreisen/wanderurlaub"), []);
  assert.deepEqual(await publicAds("trade", "solar"), []);
});

test("editorial availability excludes only admin-authorized campaigns and respects independent contexts", async () => {
  const c = await create("portal_area", "mottoreisen/wellnessangebote"), data = await save(c);
  await approve(c.id);
  await actor();
  assert.deepEqual(await rows("select * from get_ad_slot_availability($1,$1,$2)", [today, c.id]), []);
  for (const id of [owner, visitor]) {
    await actor(id);
    assert.deepEqual(await rows("select target_key,placement,status from get_ad_slot_availability($1,$1,$2)", [today, c.id]),
      [{ target_key: "mottoreisen/wellnessangebote", placement: "top_banner", status: "approved" }]);
  }
  const conflict = await create("portal_area", "mottoreisen/wellnessangebote");
  await save(conflict);
  await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [conflict.id, today], /ad_booking_conflict/);
  await denied("select save_ad_campaign($1,$2,false)", [c.id, { ...data, targets: [{ ...c.targets[0], target_key: "mottoreisen/fake" }] }]);
  assert.equal((await rows("select target_key from company_ad_campaign_targets where campaign_id=$1", [c.id]))[0].target_key, c.targets[0].target_key);
  const independent = await create("portal_area", "mottoreisen/wanderurlaub");
  await save(independent);
  await approve(independent.id);
  assert.equal((await publicAds("portal_area", "mottoreisen/wanderurlaub"))[0].id, independent.id);
});

test("company campaigns retain owner creation, isolated media, approval and conflicts with editorial banners", async () => {
  await actor(owner);
  const id = (await rows("select create_ad_campaign() as id"))[0].id;
  const image = await upload(id), data = {
    internal_name: "Firma", headline: "Firmenanzeige", target_url: "https://example.org/firma", image_path: image,
    targets: [{ target_type: "homepage", category_id: null, placement: "sidebar_top" },
      { target_type: "trade", category_id: "solar", placement: "top_banner" }],
    requested_start_date: today, requested_end_date: today, is_editorial: true, profile_id: null,
  };
  await db.query("select save_ad_campaign($1,$2,true)", [id, data]);
  assert.deepEqual(await rows("select profile_id,is_editorial,status from company_ad_campaigns where id=$1", [id]),
    [{ profile_id: owner, is_editorial: false, status: "pending" }]);
  await actor(other);
  await denied("select save_ad_campaign($1,$2,false)", [id, data], /not editable/);
  assert.equal((await rows("select can_access_ad_media($1,true) as allowed", [image]))[0].allowed, false);
  await approve(id);
  assert.equal((await publicAds("trade", "solar"))[0].id, id);
  const editorial = await create("homepage", null, "sidebar_top");
  await save(editorial);
  await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [editorial.id, today], /ad_booking_conflict/);
  // An approved editorial update colliding with a company booking rolls back fully.
  const free = await create("homepage", null, "sidebar_middle"), freeData = await save(free);
  await approve(free.id);
  await denied("select save_ad_campaign($1,$2,false)", [free.id, { ...freeData, targets: editorial.targets }], /ad_booking_conflict/);
  assert.equal((await rows("select placement from company_ad_campaign_targets where campaign_id=$1", [free.id]))[0].placement, "sidebar_middle");
  await actor(owner);
  await denied("select save_ad_campaign($1,$2,false)", [id, data], /not editable/);
  await actor();
  const adminCompany = (await rows("select create_admin_ad_campaign($1) as id", [other]))[0].id;
  assert.deepEqual(await rows("select profile_id,is_editorial from company_ad_campaigns where id=$1", [adminCompany]),
    [{ profile_id: other, is_editorial: false }]);
});

test("new RPC has fixed search_path and restricted execute; anon gains no campaign or media write rights", async () => {
  const [fn] = await rows("select prosecdef,proconfig from pg_proc where proname='create_editorial_ad_campaign'");
  assert.equal(fn.prosecdef, true);
  assert.deepEqual(fn.proconfig, ['search_path=""']);
  assert.equal((await rows("select has_function_privilege('anon','public.create_editorial_ad_campaign(text,text,text)','EXECUTE') as allowed"))[0].allowed, false);
  assert.equal((await rows("select has_function_privilege('authenticated','public.create_editorial_ad_campaign(text,text,text)','EXECUTE') as allowed"))[0].allowed, true);
  for (const role of ["anon", "authenticated"]) {
    for (const table of ["public.company_ad_campaigns", "public.company_ad_campaign_targets"])
      for (const privilege of ["INSERT", "UPDATE", "DELETE"])
        assert.equal((await rows("select has_table_privilege($1,$2,$3) as allowed", [role, table, privilege]))[0].allowed, false);
  }
  await actor("", "anon");
  await denied("insert into storage.objects(bucket_id,name) values('ad-media','forged')", [], /permission denied/);
  await denied("select get_ad_slot_availability($1,$1,null)", [today], /permission denied/);
});
