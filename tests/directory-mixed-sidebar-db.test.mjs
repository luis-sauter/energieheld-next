import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const outsider = "44444444-4444-4444-8444-444444444444";
const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
const pending = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const added = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const demos = ["mueller-haustechnik", "sonnenwerk-oberland", "klarblick-energieberatung", "holz-dach-berger", "elektro-lichtpunkt", "fensterwerk-isartal", "waermezeit-bayern", "dachraum-muenchen"];
const sidebar = ["sidebar_top", "sidebar_middle", "sidebar_bottom"];
let db;
const read = (file) => readFile(new URL(file, import.meta.url), "utf8");
const directory = () => db.query("select item_key,profile_id,demo_slug,sort_order from company_directory_order order by sort_order,item_key");
const slots = () => db.query("select slot,sort_order from ad_sidebar_slot_order order by sort_order,slot");
async function actor(id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function blocked(sql, params = []) {
  await db.exec("savepoint denied");
  await assert.rejects(db.query(sql, params));
  await db.exec("rollback to savepoint denied; release savepoint denied");
}

before(async () => {
  db = new PGlite();
  await db.exec(await read("./fixtures/company-schema.sql"));
  await db.exec("grant select (id,status) on company_profiles to anon");
  await db.exec(`CREATE POLICY profiles_admin_update ON company_profiles FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM portal_admins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM portal_admins WHERE user_id = auth.uid()));`);
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$2,'Firma')", [owner, owner]);
  for (const id of ids)
    await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Firma','approved')", [id, owner]);
  await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Entwurf','pending')", [pending, owner]);
  await db.exec("create table company_ad_campaigns (id uuid primary key, placement text, status text, approved_start_date date, approved_end_date date, target_url text, image_path text)");
  await db.exec("create table company_ad_campaign_targets (campaign_id uuid, target_type text, category_id text)");
  await db.query("insert into company_ad_campaigns values ($1,'sidebar_top','approved','2026-09-01','2026-10-01','https://example.org','creative.png')", [ids[0]]);
  await db.query("insert into company_ad_campaign_targets values ($1,'trade','solar')", [ids[0]]);
  await db.exec(await read("../supabase/migrations/20260925091403_company_directory_order.sql"));
  await db.exec(await read("../supabase/migrations/20260925103400_directory_demo_and_sidebar_order.sql"));
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));

test("existing real positions survive and eight stable demos follow, with generated keys", async () => {
  const rows = (await directory()).rows;
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.item_key, r.sort_order]), ids.map((id, i) => [`profile:${id}`, i]));
  assert.deepEqual(rows.slice(2).map((r) => [r.item_key, r.sort_order]), demos.map((slug, i) => [`demo:${slug}`, i + 2]));
  assert.equal(rows.some((r) => r.demo_slug === "alpenhotel-sonnental"), false);
  const rls = await db.query("select relname,relrowsecurity from pg_class where relname in ('company_directory_order','ad_sidebar_slot_order') order by relname");
  assert.deepEqual(rls.rows.map((r) => r.relrowsecurity), [true, true]);
  await blocked("insert into company_directory_order(profile_id,demo_slug,sort_order) values ($1,'demo',12)", [pending]);
  await blocked("insert into company_directory_order(sort_order) values (12)");
  await blocked("insert into company_directory_order(demo_slug,sort_order) values ('Bad Slug',12)");
  await blocked("insert into company_directory_order(demo_slug,sort_order) values ('valid-slug',-1)");
});

test("public reads demos and approved reals but not pending; only admin may write", async () => {
  for (const role of ["anon", "authenticated"])
    for (const column of ["profile_id", "demo_slug", "item_key", "sort_order"])
      assert.equal((await db.query("select has_column_privilege($1,'public.company_directory_order',$2,'SELECT') as allowed", [role, column])).rows[0].allowed, true);
  assert.equal((await db.query("select has_column_privilege('authenticated','public.company_directory_order','demo_slug','INSERT') as allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select has_column_privilege('authenticated','public.company_directory_order','sort_order','UPDATE') as allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select has_table_privilege('authenticated','public.company_directory_order','DELETE') as allowed")).rows[0].allowed, false);
  await db.query("insert into company_directory_order(profile_id,sort_order) values ($1,12)", [pending]);
  await actor(outsider, "anon");
  assert.equal((await directory()).rows.length, 10);
  await blocked("insert into company_directory_order(demo_slug,sort_order) values ('new-demo',12)");
  await blocked("select reorder_company_directory_items($1::text[])", [[`profile:${ids[0]}`]]);
  for (const user of [owner, outsider]) {
    await actor(user);
    assert.equal((await db.query("update company_directory_order set sort_order=12 where item_key=$1", [`profile:${ids[0]}`])).affectedRows, 0);
    await blocked("select reorder_company_directory_items($1::text[])", [[`profile:${ids[0]}`]]);
  }
  await actor(admin);
  assert.equal((await directory()).rows.length, 11);
});

test("mixed RPC rejects incomplete, duplicate, unknown and pending keys atomically; old RPC remains compatible", async () => {
  await actor(admin);
  const original = (await directory()).rows.map((r) => r.item_key);
  for (const bad of [null, original.slice(1), [original[0], ...original.slice(0, -1)], [...original.slice(0, -1), "demo:unknown"], [...original.slice(0, -1), `profile:${pending}`], [...original, "extra"]]) {
    await blocked("select reorder_company_directory_items($1::text[])", [bad]);
    assert.deepEqual((await directory()).rows.map((r) => r.item_key), original);
  }
  const mixed = [`demo:${demos[1]}`, `profile:${ids[1]}`, ...original.filter((key) => key !== `demo:${demos[1]}` && key !== `profile:${ids[1]}`)];
  await db.query("select reorder_company_directory_items($1::text[])", [mixed]);
  assert.deepEqual((await directory()).rows.map((r) => [r.item_key, r.sort_order]), mixed.map((key, i) => [key, i]));
  await db.query("select reorder_company_directory_profiles($1::uuid[])", [[ids[1], ids[0]]]);
  assert.deepEqual((await directory()).rows.slice(0, 2).map((r) => r.item_key), [`profile:${ids[1]}`, `profile:${ids[0]}`]);
});

test("new approved profile has no row and joins next complete save", async () => {
  await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Neu','approved')", [added, owner]);
  await actor(admin);
  assert.equal((await directory()).rows.some((r) => r.profile_id === added), false);
  const keys = [...(await directory()).rows.map((r) => r.item_key), `profile:${added}`];
  await db.query("select reorder_company_directory_items($1::text[])", [keys]);
  assert.deepEqual((await directory()).rows.at(-1), { item_key: `profile:${added}`, profile_id: added, demo_slug: null, sort_order: 10 });
});

test("real profile deletion still cascades its ordering row", async () => {
  await db.query("delete from company_profiles where id=$1", [ids[0]]);
  assert.equal((await directory()).rows.some((row) => row.profile_id === ids[0]), false);
  assert.equal((await directory()).rows.filter((row) => row.demo_slug).length, 8);
});

test("sidebar has three public fixed slots; only admin RPC changes their positions", async () => {
  assert.deepEqual((await slots()).rows, sidebar.map((slot, sort_order) => ({ slot, sort_order })));
  for (const role of ["anon", "authenticated"])
    for (const column of ["slot", "sort_order", "updated_at"])
      assert.equal((await db.query("select has_column_privilege($1,'public.ad_sidebar_slot_order',$2,'SELECT') as allowed", [role, column])).rows[0].allowed, true);
  assert.equal((await db.query("select has_column_privilege('anon','public.ad_sidebar_slot_order','sort_order','UPDATE') as allowed")).rows[0].allowed, false);
  assert.equal((await db.query("select has_column_privilege('authenticated','public.ad_sidebar_slot_order','sort_order','UPDATE') as allowed")).rows[0].allowed, true);
  await actor(outsider, "anon");
  assert.deepEqual((await slots()).rows.map((r) => r.slot), sidebar);
  await blocked("select reorder_ad_sidebar_slots($1::text[])", [sidebar]);
  await blocked("insert into ad_sidebar_slot_order(slot,sort_order) values ('other',0)");
  await actor(owner);
  assert.equal((await db.query("update ad_sidebar_slot_order set sort_order=2 where slot='sidebar_top'")).affectedRows, 0);
  await blocked("select reorder_ad_sidebar_slots($1::text[])", [sidebar]);
  await actor(admin);
  for (const bad of [null, sidebar.slice(1), [sidebar[0], sidebar[0], sidebar[2]], [sidebar[0], sidebar[1], "other"]]) {
    await blocked("select reorder_ad_sidebar_slots($1::text[])", [bad]);
    assert.deepEqual((await slots()).rows.map((r) => r.slot), sidebar);
  }
  const reordered = [sidebar[2], sidebar[0], sidebar[1]];
  await db.query("select reorder_ad_sidebar_slots($1::text[])", [reordered]);
  assert.deepEqual((await slots()).rows, reordered.map((slot, sort_order) => ({ slot, sort_order })));
  await db.exec("reset role");
  const campaign = (await db.query("select placement,status,approved_start_date,approved_end_date,target_url,image_path from company_ad_campaigns")).rows;
  const targets = (await db.query("select target_type,category_id from company_ad_campaign_targets")).rows;
  assert.deepEqual(campaign.map((row) => ({ ...row, approved_start_date: row.approved_start_date.toISOString().slice(0, 10), approved_end_date: row.approved_end_date.toISOString().slice(0, 10) })), [{ placement: "sidebar_top", status: "approved", approved_start_date: "2026-09-01", approved_end_date: "2026-10-01", target_url: "https://example.org", image_path: "creative.png" }]);
  assert.deepEqual(targets, [{ target_type: "trade", category_id: "solar" }]);
});
