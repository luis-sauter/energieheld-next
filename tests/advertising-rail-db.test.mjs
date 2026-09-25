import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const first = ["sidebar_top", "sidebar_middle", "sidebar_bottom"];
const added = Array.from({ length: 9 }, (_, i) => `sidebar_${String(i + 4).padStart(2, "0")}`);
let db, today, draftIds;
const migration = async (name) => db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
const slots = async () => (await db.query("select slot from ad_sidebar_slot_order order by sort_order,slot")).rows.map((row) => row.slot);
async function actor(id = owner, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function denied(query, params = []) {
  await db.exec("savepoint denied");
  await assert.rejects(db.query(query, params));
  await db.exec("rollback to savepoint denied; release savepoint denied");
}

before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create table auth.users(id uuid primary key)");
  await db.query("insert into auth.users values($1),($2),($3)", [owner, other, admin]);
  await db.query("insert into portal_admins values($1)", [admin]);
  for (const id of [owner, other]) {
    await db.query("insert into companies values($1,$1,'Firma')", [id]);
    await db.query("insert into company_profiles(id,company_id,display_name,status) values($1,$1,'Firma','draft')", [id]);
  }
  await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'solar'),($2,'solar')", [owner, other]);
  await migration("20260917203041_company_ad_campaigns.sql");
  await migration("20260918202110_company_ad_campaign_targets.sql");
  await migration("20260925091403_company_directory_order.sql");
  await migration("20260925103400_directory_demo_and_sidebar_order.sql");
  draftIds = (await db.query("insert into company_ad_campaigns(profile_id) select $1 from generate_series(1,3) returning id", [owner])).rows.map((r) => r.id);
  // Model an editorial order that differs from the original identifier sequence.
  await db.exec("update ad_sidebar_slot_order set sort_order=case slot when 'sidebar_middle' then 0 when 'sidebar_bottom' then 1 else 2 end");
  await migration("20260925160039_expand_legacy_advertising_rail.sql");
  today = (await db.query("select ((now() at time zone 'Europe/Berlin')::date)::text as day")).rows[0].day;
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));

test("migration keeps first-three stored order and drafts while adding nine slots", async () => {
  assert.deepEqual(await slots(), ["sidebar_middle", "sidebar_bottom", "sidebar_top", ...added]);
  assert.deepEqual((await db.query("select id from company_ad_campaigns order by id")).rows.map((r) => r.id).sort(), [...draftIds].sort());
  assert.deepEqual((await db.query("select relname from pg_class where relname in ('company_ad_campaigns','company_ad_campaign_targets','ad_sidebar_slot_order') and relrowsecurity order by relname")).rows.map((r) => r.relname), ["ad_sidebar_slot_order", "company_ad_campaign_targets", "company_ad_campaigns"]);
  const functionInfo = (await db.query("select prosecdef,proconfig from pg_proc where proname='reorder_ad_sidebar_slots'")).rows[0];
  assert.equal(functionInfo.prosecdef, false);
  assert.match(JSON.stringify(functionInfo.proconfig), /search_path/);
  assert.equal((await db.query("select has_function_privilege('anon','public.reorder_ad_sidebar_slots(text[])','EXECUTE') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.reorder_ad_sidebar_slots(text[])','EXECUTE') as allowed")).rows[0].allowed, true);
});

test("legacy three-slot and full twelve-slot calls are exact, admin-only permutations", async () => {
  const original = await slots();
  await actor("", "anon");
  await denied("select reorder_ad_sidebar_slots($1::text[])", [first]);
  await actor(other);
  await denied("select reorder_ad_sidebar_slots($1::text[])", [first]);
  await actor(admin);
  for (const bad of [null, first.slice(0, 2), [...first, added[0]], [...original.slice(0, -1)], [...original, "extra"], [first[0], first[0], first[2]], [first[0], first[1], "unknown"]]) {
    await denied("select reorder_ad_sidebar_slots($1::text[])", [bad]);
    assert.deepEqual(await slots(), original);
  }
  const twelve = [...added.slice().reverse(), ...first];
  await db.query("select reorder_ad_sidebar_slots($1::text[])", [twelve]);
  assert.deepEqual(await slots(), twelve);
  await db.query("select reorder_ad_sidebar_slots($1::text[])", [[first[2], first[0], first[1]]]);
  assert.deepEqual(await slots(), [first[2], first[0], first[1], ...added.slice().reverse()]);
});

async function campaign(profile, placement, targets) {
  await actor(profile);
  const id = (await db.query("select create_ad_campaign() as id")).rows[0].id;
  const image = `campaigns/${id}/creative/${crypto.randomUUID()}.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)", [image]);
  await db.query("select save_ad_campaign($1,$2,true)", [id, {
    internal_name: "Buchung", placement, targets, headline: "Banner", body_text: null,
    target_url: "https://example.org", image_path: image,
    requested_start_date: today, requested_end_date: today,
  }]);
  return id;
}
async function approve(id) {
  await actor(admin);
  await db.query("select review_ad_campaign($1,'approve',$2,$2,null)", [id, today]);
}
async function publicAds(target, category = null) {
  await actor("", "anon");
  return (await db.query("select id,placement from get_active_ad_campaigns($1,$2)", [target, category])).rows;
}

test("homepage shape is enforced and homepage, directory, trade bookings stay isolated", async () => {
  const home = await campaign(owner, "sidebar_04", [{ target_type: "homepage", category_id: null }]);
  await approve(home);
  assert.deepEqual(await publicAds("homepage"), [{ id: home, placement: "sidebar_04" }]);
  assert.deepEqual(await publicAds("experts_directory"), []);
  assert.deepEqual(await publicAds("trade", "solar"), []);
  const directory = await campaign(other, "sidebar_04", [{ target_type: "experts_directory", category_id: null }]);
  await approve(directory);
  assert.deepEqual(await publicAds("experts_directory"), [{ id: directory, placement: "sidebar_04" }]);
  const trade = await campaign(owner, "sidebar_04", [{ target_type: "trade", category_id: "solar" }]);
  await approve(trade);
  assert.deepEqual(await publicAds("trade", "solar"), [{ id: trade, placement: "sidebar_04" }]);
  assert.deepEqual(await publicAds("trade", "dach"), []);
  const anotherHomeSlot = await campaign(other, "sidebar_05", [{ target_type: "homepage", category_id: null }]);
  await approve(anotherHomeSlot);
  const sameHomeSlot = await campaign(other, "sidebar_04", [{ target_type: "homepage", category_id: null }]);
  await actor(admin);
  await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [sameHomeSlot, today]);
  const invalid = await campaign(owner, "sidebar_06", [{ target_type: "homepage", category_id: null }]);
  await actor(admin, "postgres");
  await denied("update company_ad_campaign_targets set category_id='solar' where campaign_id=$1", [invalid]);
});
