import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const grid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const path = `profiles/${profile}/blocks/${grid}/33333333-3333-4333-8333-333333333333.jpg`;
const logo = `profiles/${profile}/logo/11111111-1111-4111-8111-111111111111.jpg`;
const gallery = `profiles/${profile}/gallery/22222222-2222-4222-8222-222222222222.jpg`;
let db;

before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create policy profiles_admin_update on company_profiles for update to authenticated using (exists(select 1 from portal_admins where user_id=auth.uid())) with check (exists(select 1 from portal_admins where user_id=auth.uid()))");
  for (const file of ["20260924155258_admin_company_media_editor.sql",
    "20260924171344_profile_content_blocks.sql", "20260924202803_profile_image_grid_blocks.sql"])
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  for (const id of [profile, foreign]) {
    await db.query("insert into company_profiles(id,company_id,display_name,status,description,business_areas) values ($1,$2,'Firma','pending','Beschreibung','Bereich')", [id, owner]);
    await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'heizung')", [id]);
    await db.query("update company_profiles set status='approved' where id=$1", [id]);
  }
  await db.query("update company_profiles set logo_path=$1 where id=$2", [logo, profile]);
  await db.query("insert into company_profile_images(profile_id,storage_path,sort_order) values ($1,$2,0)", [profile, gallery]);
  await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values ($1,$2,'image_grid','{}','{\"columns\":2}')", [grid, profile]);
  await db.query("insert into profile_content_block_images(block_id,storage_path,sort_order) values ($1,$2,0)", [grid, path]);
  for (const type of ["heading", "text"])
    await db.query("insert into profile_content_blocks(profile_id,type,content) values ($1,$2,$3)", [profile, type, { text: type }]);
  await db.query("insert into profile_content_blocks(profile_id,type,slot,content) values ($1,'heading','about_heading',$2)",
    [profile, { text: "Über die Firma" }]);
  await db.exec(await readFile(new URL("../supabase/migrations/20260924210916_profile_image_grid_resizing.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/20260924214027_universal_content_block_layout.sql", import.meta.url), "utf8"));
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function actor(id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function blocked(sql, params = []) {
  await db.exec("savepoint denied");
  await assert.rejects(db.query(sql, params));
  await db.exec("rollback to savepoint denied;release savepoint denied");
}

test("migration fills universal defaults and preserves content, images, logo and gallery", async () => {
  const rows = (await db.query("select type,config,content from profile_content_blocks where profile_id=$1 order by type", [profile])).rows;
  for (const row of rows.filter((row) => row.type !== "image_grid" && row.content.text !== "Über die Firma"))
    assert.deepEqual(row.config, { width_percent: 100, offset_percent: 0, text_align: "left", spacing_top: "normal", spacing_bottom: "normal" });
  assert.deepEqual(rows.find((row) => row.content.text === "Über die Firma").config, {});
  assert.deepEqual(rows.find((row) => row.type === "image_grid").config,
    { columns: 2, width_percent: 100, offset_percent: 0, aspect_ratio: 1.5, spacing_top: "normal", spacing_bottom: "normal" });
  assert.deepEqual((await db.query("select storage_path from profile_content_block_images where block_id=$1", [grid])).rows,
    [{ storage_path: path }]);
  assert.equal((await db.query("select count(*)::int as n from profile_content_blocks where content->>'text' in ('heading','text')")).rows[0].n, 2);
  assert.equal((await db.query("select logo_path from company_profiles where id=$1", [profile])).rows[0].logo_path, logo);
  assert.equal((await db.query("select storage_path from company_profile_images where profile_id=$1", [profile])).rows[0].storage_path, gallery);
});

test("new free blocks receive universal defaults while fixed headings retain their own schema", async () => {
  await actor(admin);
  for (const [type, text] of [["heading", "Titel"], ["text", "Absatz"], ["image_grid", ""]]) {
    const id = (await db.query("select insert_profile_content_block($1,$2,$3,null) as id", [profile, type, text])).rows[0].id;
    const config = (await db.query("select config from profile_content_blocks where id=$1", [id])).rows[0].config;
    assert.deepEqual(config, type === "image_grid"
      ? { columns: 1, width_percent: 100, offset_percent: 0, aspect_ratio: 1.5, spacing_top: "normal", spacing_bottom: "normal" }
      : { width_percent: 100, offset_percent: 0, text_align: "left", spacing_top: "normal", spacing_bottom: "normal" });
  }
});

test("strict constraints accept exact layout bounds and reject overflow, bad keys and bad enums", async () => {
  await actor(admin);
  const base = { columns: 2, width_percent: 25, offset_percent: 75, aspect_ratio: 1.5,
    spacing_top: "small", spacing_bottom: "large" };
  await db.query("update profile_content_blocks set config=$1 where id=$2", [base, grid]);
  await db.query("update profile_content_blocks set config=$1 where id=$2", [{ ...base, width_percent: 75, offset_percent: 12.5 }, grid]);
  await db.query("update profile_content_blocks set config=$1 where id=$2", [{ ...base, width_percent: 100, offset_percent: 0 }, grid]);
  for (const config of [
    { ...base, width_percent: 24 }, { ...base, width_percent: 101 },
    { ...base, offset_percent: -1 }, { ...base, offset_percent: 75.1 },
    { ...base, offset_percent: 12.55 }, { ...base, spacing_top: "huge" },
    { ...base, spacing_bottom: "tiny" }, { ...base, text_align: "center" },
    { ...base, arbitrary: true }, { ...base, aspect_ratio: 1.234 },
  ]) await blocked("update profile_content_blocks set config=$1 where id=$2", [config, grid]);
  const heading = (await db.query("select id,config from profile_content_blocks where profile_id=$1 and type='heading' and slot is null", [profile])).rows[0];
  for (const align of ["left", "center", "right"])
    await db.query("update profile_content_blocks set config=$1 where id=$2", [{ ...heading.config, text_align: align }, heading.id]);
  await blocked("update profile_content_blocks set config=$1 where id=$2", [{ ...heading.config, text_align: "justify" }, heading.id]);
});

test("duplicate RPC copies text/layout and creates an empty image block immediately after source", async () => {
  await actor(admin);
  const heading = (await db.query("select id from profile_content_blocks where profile_id=$1 and type='heading' and slot is null", [profile])).rows[0].id;
  const text = (await db.query("select id from profile_content_blocks where profile_id=$1 and type='text'", [profile])).rows[0].id;
  for (const source of [heading, text, grid]) {
    const copy = (await db.query("select duplicate_profile_content_block($1,$2) as id", [profile, source])).rows[0].id;
    const rows = (await db.query("select id,type,sort_order,content,config from profile_content_blocks where id in ($1,$2) order by sort_order", [source, copy])).rows;
    assert.deepEqual(rows.map((row) => row.id), [source, copy]);
    assert.deepEqual(rows[1].config, rows[0].config);
    assert.deepEqual(rows[1].content, rows[0].content);
    assert.equal((await db.query("select count(*)::int as n from profile_content_block_images where block_id=$1", [copy])).rows[0].n, 0);
  }
  await blocked("select duplicate_profile_content_block($1,$2)", [foreign, grid]);
  await actor(owner);
  await blocked("select duplicate_profile_content_block($1,$2)", [profile, grid]);
  await actor("", "anon");
  await blocked("select duplicate_profile_content_block($1,$2)", [profile, grid]);
});
