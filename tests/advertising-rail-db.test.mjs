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
  await migration("20260930120000_ad_target_placements.sql");
  // The Cloud already has the controlled taxonomy; fixture terms prove that
  // portal ad areas derive from its theme rows rather than a copied SQL list.
  await db.exec("create table public.travel_terms(dimension text not null,slug text not null)");
  await db.exec("insert into public.travel_terms values ('theme','wellnessangebote'),('theme','wanderurlaub'),('theme','natur-pur')");
  await db.query("insert into company_ad_campaign_targets(campaign_id,target_type,placement) values($1,'homepage','top_banner')", [draftIds[0]]);
  await migration("20260930143000_portal_ad_target_areas.sql");
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
  assert.deepEqual((await db.query("select target_type,category_id,target_key,placement from company_ad_campaign_targets where campaign_id=$1", [draftIds[0]])).rows,
    [{ target_type: "homepage", category_id: null, target_key: null, placement: "top_banner" }]);
  assert.equal((await db.query("select count(*)::int as total from ad_portal_areas")).rows[0].total, 9);
  assert.equal((await db.query("select has_table_privilege('authenticated','public.ad_portal_areas','INSERT') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_table_privilege('anon','public.company_ad_campaign_targets','INSERT') as allowed")).rows[0].allowed, false);
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

test("one campaign persists multiple themes and destinations without duplicate cards or slot cross products", async () => {
  const pairs = [
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen/natur-pur", placement: "top_banner" },
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen/wellnessangebote", placement: "sidebar_top" },
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen/wanderurlaub", placement: "top_banner" },
    { target_type: "portal_area", category_id: null, target_key: "reiseziele/deutschland", placement: "sidebar_middle" },
    { target_type: "portal_area", category_id: null, target_key: "reiseziele/oesterreich", placement: "sidebar_middle" },
  ];
  const id = await campaign(owner, "top_banner", pairs);
  const readPairs = async () => (await db.query("select target_type,category_id,target_key,placement from company_ad_campaign_targets where campaign_id=$1 order by target_key", [id])).rows;
  const saved = await readPairs();
  assert.deepEqual(saved, [...pairs].sort((a, b) => a.target_key.localeCompare(b.target_key)));
  // A fresh role context reads the same persisted pairs; no client state is involved.
  await actor(other);
  assert.deepEqual(await readPairs(), []);
  await actor(owner);
  assert.deepEqual(await readPairs(), saved);
  const creative = (await db.query("select * from company_ad_campaigns where id=$1", [id])).rows[0];
  await actor(admin);
  await denied("select save_ad_campaign($1,$2,false)", [id, { ...creative, targets: [...pairs, pairs[0]] }]);
  assert.deepEqual(await readPairs(), saved, "failed duplicate save leaves all targets intact");
  await approve(id);
  for (const pair of pairs) assert.deepEqual(await publicAds("portal_area", pair.target_key), [{ id, placement: pair.placement }]);
});

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

test("independent page/placement pairs persist, deliver exactly, and book only matching pairs", async () => {
  const pairs = [
    { target_type: "homepage", category_id: null, placement: "top_banner" },
    { target_type: "experts_directory", category_id: null, placement: "sidebar_top" },
    { target_type: "experts_directory", category_id: null, placement: "sidebar_middle" },
  ];
  const id = await campaign(owner, "top_banner", pairs);
  const stored = (await db.query("select target_type,placement from company_ad_campaign_targets where campaign_id=$1 order by target_type,placement", [id])).rows;
  assert.deepEqual(stored, [
    { target_type: "experts_directory", placement: "sidebar_middle" },
    { target_type: "experts_directory", placement: "sidebar_top" },
    { target_type: "homepage", placement: "top_banner" },
  ]);
  await approve(id);
  assert.deepEqual(await publicAds("homepage"), [{ id, placement: "top_banner" }]);
  assert.deepEqual(await publicAds("experts_directory"), [
    { id, placement: "sidebar_middle" }, { id, placement: "sidebar_top" },
  ]);
  const otherPageSameSlot = await campaign(other, "top_banner", [{ target_type: "experts_directory", category_id: null, placement: "top_banner" }]);
  await approve(otherPageSameSlot);
  const samePageSameSlot = await campaign(other, "top_banner", [{ target_type: "homepage", category_id: null, placement: "top_banner" }]);
  await actor(admin);
  await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [samePageSameSlot, today]);
  const availability = (await db.query("select target_type,placement,status from get_ad_slot_availability($1,$1,$2) order by target_type,placement", [today, samePageSameSlot])).rows;
  assert.ok(availability.some((slot) => slot.target_type === "homepage" && slot.placement === "top_banner" && slot.status === "approved"));
  assert.ok(availability.some((slot) => slot.target_type === "experts_directory" && slot.placement === "top_banner" && slot.status === "approved"));
  assert.ok(!availability.some((slot) => slot.target_type === "homepage" && slot.placement === "sidebar_top"));
});

test("portal overview, theme and destination pairs stay independent for delivery and booking", async () => {
  const pairs = [
    { target_type: "homepage", category_id: null, placement: "top_banner" },
    { target_type: "experts_directory", category_id: null, placement: "sidebar_top" },
    { target_type: "experts_directory", category_id: null, placement: "sidebar_middle" },
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen", placement: "sidebar_top" },
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen/wellnessangebote", placement: "top_banner" },
    { target_type: "portal_area", category_id: null, target_key: "mottoreisen/wanderurlaub", placement: "top_banner" },
    { target_type: "portal_area", category_id: null, target_key: "reiseziele", placement: "sidebar_top" },
    { target_type: "portal_area", category_id: null, target_key: "reiseziele/deutschland", placement: "sidebar_middle" },
  ];
  const id = await campaign(owner, "top_banner", pairs);
  assert.deepEqual((await db.query("select target_type,target_key,placement from company_ad_campaign_targets where campaign_id=$1 order by target_type,target_key,placement", [id])).rows.length, 8);
  await approve(id);
  for (const [key, slot] of [
    ["mottoreisen", "sidebar_top"], ["mottoreisen/wellnessangebote", "top_banner"],
    ["mottoreisen/wanderurlaub", "top_banner"], ["reiseziele", "sidebar_top"],
    ["reiseziele/deutschland", "sidebar_middle"],
  ]) assert.deepEqual(await publicAds("portal_area", key), [{ id, placement: slot }]);
  assert.deepEqual(await publicAds("portal_area", "reiseziele/oesterreich"), []);
  const otherRegion = await campaign(other, "sidebar_middle", [
    { target_type: "portal_area", category_id: null, target_key: "reiseziele/oesterreich", placement: "sidebar_middle" },
  ]);
  await approve(otherRegion);
  const sameRegion = await campaign(other, "sidebar_middle", [
    { target_type: "portal_area", category_id: null, target_key: "reiseziele/deutschland", placement: "sidebar_middle" },
  ]);
  await actor(admin);
  await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [sameRegion, today]);
  const availability = (await db.query("select target_key,placement,status from get_ad_slot_availability($1,$1,$2) where target_type='portal_area'", [today, sameRegion])).rows;
  assert.ok(availability.some((slot) => slot.target_key === "reiseziele/deutschland" && slot.placement === "sidebar_middle" && slot.status === "approved"));
  assert.ok(availability.some((slot) => slot.target_key === "reiseziele/oesterreich" && slot.placement === "sidebar_middle" && slot.status === "approved"));
  await actor(owner);
  const invalid = (await db.query("select create_ad_campaign() as id")).rows[0].id;
  await denied("select save_ad_campaign($1,$2,false)", [invalid, {
    internal_name: "Ungültig", headline: "Ungültig", target_url: "https://example.org", image_path: null,
    requested_start_date: today, requested_end_date: today,
    targets: [{ target_type: "portal_area", category_id: null, target_key: "reiseziele/erfunden", placement: "sidebar_top" }],
  }]);
});

test("admin creates a campaign for a real profile and cannot bypass media path or slot rules", async () => {
  await actor("", "anon");
  await denied("select create_admin_ad_campaign($1)", [other]);
  await actor(other);
  await denied("select create_admin_ad_campaign($1)", [other]);
  await actor(admin);
  const id = (await db.query("select create_admin_ad_campaign($1) as id", [other])).rows[0].id;
  assert.equal((await db.query("select profile_id from company_ad_campaigns where id=$1", [id])).rows[0].profile_id, other);
  assert.equal((await db.query("select can_access_ad_media($1,true) as allowed", [`campaigns/${id}/creative/${crypto.randomUUID()}.png`])).rows[0].allowed, true);
  const image = `campaigns/${id}/creative/${crypto.randomUUID()}.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)", [image]);
  const creative = {
    internal_name: "Redaktionelles Banner", placement: "top_banner",
    targets: [{ target_type: "homepage", category_id: null, placement: "top_banner" }],
    headline: "Anzeige", body_text: null, target_url: "https://example.org/angebot",
    image_path: image, requested_start_date: today, requested_end_date: today,
    contact_name: "Carola", contact_phone: "+49 123", contact_email: "carola@example.org",
  };
  await db.query("select save_ad_campaign($1,$2,true)", [id, creative]);
  await db.query("select review_ad_campaign($1,'approve',$2,$2,null)", [id, today]);
  await db.query("select save_ad_campaign($1,$2,false)", [id, { ...creative, target_url: "https://example.org/neues-ziel" }]);
  assert.deepEqual((await db.query("select status,target_url,contact_name from company_ad_campaigns where id=$1", [id])).rows,
    [{ status: "approved", target_url: "https://example.org/neues-ziel", contact_name: "Carola" }]);
  await actor(owner);
  await denied("select save_ad_campaign($1,$2,false)", [id, creative]);
  await actor(admin);
  await denied("select create_admin_ad_campaign($1)", ["99999999-9999-4999-8999-999999999999"]);
});

test("customer may request without a creative; admin adds the private image before approval", async () => {
  await actor(owner);
  const id = (await db.query("select create_ad_campaign() as id")).rows[0].id;
  const request = {
    internal_name: "Anfrage", placement: "sidebar_top",
    targets: [{ target_type: "homepage", category_id: null, placement: "sidebar_top" }],
    headline: "Anzeige", target_url: "https://example.org", image_path: null,
    requested_start_date: today, requested_end_date: today,
  };
  await db.query("select save_ad_campaign($1,$2,true)", [id, request]);
  assert.equal((await db.query("select image_path,status from company_ad_campaigns where id=$1", [id])).rows[0].image_path, null);
  await actor(admin);
  await denied("select review_ad_campaign($1,'approve',$2,$2,null)", [id, today]);
  const image = `campaigns/${id}/creative/${crypto.randomUUID()}.png`;
  await db.query("insert into storage.objects(bucket_id,name) values('ad-media',$1)", [image]);
  await db.query("select save_ad_campaign($1,$2,false)", [id, { ...request, image_path: image }]);
  await db.query("select review_ad_campaign($1,'approve',$2,$2,null)", [id, today]);
  assert.deepEqual(await publicAds("homepage"), [{ id, placement: "sidebar_top" }]);
});

test("availability distinguishes pending, inclusive overlap, and a free later period", async () => {
  const id = await campaign(owner, "sidebar_04", [
    { target_type: "homepage", category_id: null, placement: "sidebar_04" },
  ]);
  await actor(other);
  const pending = (await db.query("select * from get_ad_slot_availability($1,$1,null)", [today])).rows;
  assert.deepEqual(pending, [{ target_type: "homepage", category_id: null, target_key: null, placement: "sidebar_04", status: "pending" }]);
  assert.deepEqual((await db.query("select * from get_ad_slot_availability(($1::date+1),($1::date+1),null)", [today])).rows, []);
  await approve(id);
  await actor(other);
  const booked = (await db.query("select * from get_ad_slot_availability($1,$1,null)", [today])).rows;
  assert.equal(booked[0].status, "approved");
  const ownExclusion = (await db.query("select * from get_ad_slot_availability($1,$1,$2)", [today, id])).rows;
  assert.equal(ownExclusion.length, 1, "a foreign campaign ID cannot hide a booking");
});
