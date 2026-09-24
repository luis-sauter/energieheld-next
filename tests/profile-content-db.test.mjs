import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const outsider = "22222222-2222-4222-8222-222222222222";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const unpublished = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let db;

before(async () => {
  db = await createMediaTestDatabase(true);
  // The compact fixture omits the production admin UPDATE policy needed by FOR UPDATE.
  await db.exec("create policy profiles_admin_update on company_profiles for update to authenticated using (exists(select 1 from portal_admins where user_id=auth.uid())) with check (exists(select 1 from portal_admins where user_id=auth.uid()))");
  await db.exec(await readFile(new URL("../supabase/migrations/20260924171344_profile_content_blocks.sql", import.meta.url), "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  for (const id of [profile, foreign, unpublished])
    await db.query("insert into company_profiles(id,company_id,display_name,status,description,business_areas) values ($1,$2,'Firma','pending','Bestehende Beschreibung','Bestehende Tätigkeiten')", [id, owner]);
  for (const id of [profile, foreign]) {
    await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'heizung')", [id]);
    await db.query("update company_profiles set status='approved' where id=$1", [id]);
  }
  await db.query("insert into profile_content_blocks(profile_id,type,content) values ($1,'text',$2)", [unpublished, { text: "Nicht veröffentlicht" }]);
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function actor(id = "", role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function blocked(sql, params = []) {
  await db.exec("savepoint denied");
  await assert.rejects(db.query(sql, params));
  await db.exec("rollback to savepoint denied;release savepoint denied");
}
async function insert(id, type, content, before = null) {
  return (await db.query("select insert_profile_content_block($1,$2,$3,$4) as id", [id, type, content, before])).rows[0].id;
}

test("public reads only approved profile blocks and never receives edit rights", async () => {
  await actor(admin);
  const publishedId = await insert(profile, "heading", "Unsere Leistungen");
  await blocked("insert into profile_content_blocks(profile_id,type,content) values ($1,'text',$2)", [unpublished, { text: "Geheim" }]);
  await actor("", "anon");
  const rows = await db.query("select id,content from profile_content_blocks");
  assert.deepEqual(rows.rows.map((row) => row.id), [publishedId]);
  await blocked("insert into profile_content_blocks(profile_id,type,content) values ($1,'heading',$2)", [profile, { text: "Nein" }]);
  await blocked("update profile_content_blocks set content=$1 where id=$2", [{ text: "Nein" }, publishedId]);
});

test("only portal admins can insert, edit and delete; owner and non-admin remain read-only", async () => {
  await actor(admin);
  const id = await insert(profile, "heading", "Unsere Leistungen");
  for (const user of [owner, outsider]) {
    await actor(user);
    await blocked("insert into profile_content_blocks(profile_id,type,content) values ($1,'text',$2)", [profile, { text: "Verboten" }]);
    assert.equal((await db.query("update profile_content_blocks set content=$1 where id=$2 returning id", [{ text: "Verboten" }, id])).rows.length, 0);
    assert.equal((await db.query("delete from profile_content_blocks where id=$1 returning id", [id])).rows.length, 0);
    await blocked("select insert_profile_content_block($1,'text','Verboten',null)", [profile]);
  }
  await actor(admin);
  const textId = await insert(profile, "text", "Mehrzeiliger Text");
  await db.query("update profile_content_blocks set content=$1 where id=$2", [{ text: "Aktualisiert" }, textId]);
  assert.equal((await db.query("select content->>'text' as text from profile_content_blocks where id=$1", [textId])).rows[0].text, "Aktualisiert");
  await db.query("delete from profile_content_blocks where id=$1", [textId]);
  assert.equal((await db.query("select count(*)::int as n from profile_content_blocks where id=$1", [textId])).rows[0].n, 0);
});

test("insertion and reorder keep a persistent exact order and reject foreign block IDs", async () => {
  await actor(admin);
  const first = await insert(profile, "heading", "Erstens");
  const last = await insert(profile, "text", "Drittens");
  const middle = await insert(profile, "text", "Zweitens", last);
  const order = async () => (await db.query("select id from profile_content_blocks where profile_id=$1 and slot is null order by sort_order,id", [profile])).rows.map((row) => row.id);
  assert.deepEqual(await order(), [first, middle, last]);
  const foreignId = await insert(foreign, "heading", "Anderes Profil");
  await blocked("select insert_profile_content_block($1,'text','Angriff',$2)", [profile, foreignId]);
  await blocked("select reorder_profile_content_blocks($1,$2::uuid[])", [profile, [first, foreignId, last]]);
  await db.query("select reorder_profile_content_blocks($1,$2::uuid[])", [profile, [last, first, middle]]);
  assert.deepEqual(await order(), [last, first, middle]);
  assert.equal((await db.query("select sort_order from profile_content_blocks where id=$1", [foreignId])).rows[0].sort_order, 0);
});

test("heading overrides are unique and do not replace existing structured content", async () => {
  await actor(admin);
  await db.query("insert into profile_content_blocks(profile_id,type,slot,content) values ($1,'heading','about_heading',$2)", [profile, { text: "Über uns" }]);
  await blocked("insert into profile_content_blocks(profile_id,type,slot,content) values ($1,'heading','about_heading',$2)", [profile, { text: "Doppelt" }]);
  await blocked("insert into profile_content_blocks(profile_id,type,slot,content) values ($1,'text','business_areas_heading',$2)", [profile, { text: "Falscher Typ" }]);
  await blocked("insert into profile_content_blocks(profile_id,type,content) values ($1,'text',$2)", [profile, {}]);
  const existing = (await db.query("select description,business_areas from company_profiles where id=$1", [profile])).rows[0];
  assert.deepEqual(existing, { description: "Bestehende Beschreibung", business_areas: "Bestehende Tätigkeiten" });
});
