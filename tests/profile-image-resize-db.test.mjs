import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const grid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const image = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const logo = `profiles/${profile}/logo/11111111-1111-4111-8111-111111111111.jpg`;
const gallery = `profiles/${profile}/gallery/22222222-2222-4222-8222-222222222222.jpg`;
const blockImage = `profiles/${profile}/blocks/${grid}/33333333-3333-4333-8333-333333333333.jpg`;
let db;

before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create policy profiles_admin_update on company_profiles for update to authenticated using (exists(select 1 from portal_admins where user_id=auth.uid())) with check (exists(select 1 from portal_admins where user_id=auth.uid()))");
  for (const file of ["20260924155258_admin_company_media_editor.sql",
    "20260924171344_profile_content_blocks.sql",
    "20260924202803_profile_image_grid_blocks.sql"])
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  await db.query("insert into company_profiles(id,company_id,display_name,status,description,business_areas,logo_path) values ($1,$2,'Firma','pending','Beschreibung','Bereich',$3)", [profile, owner, logo]);
  await db.query("insert into company_profile_images(profile_id,storage_path,sort_order) values ($1,$2,0)", [profile, gallery]);
  await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'heizung')", [profile]);
  await db.query("update company_profiles set status='approved' where id=$1", [profile]);
  await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values ($1,$2,'image_grid','{}','{\"columns\":2}')", [grid, profile]);
  await db.query("insert into profile_content_block_images(id,block_id,storage_path,alt_text,sort_order) values ($1,$2,$3,'Ansicht',0)", [image, grid, blockImage]);
  await db.query("insert into profile_content_blocks(profile_id,type,content) values ($1,'heading','{\"text\":\"Titel\"}'),($1,'text','{\"text\":\"Inhalt\"}')", [profile]);
  await db.exec(await readFile(new URL("../supabase/migrations/20260924210916_profile_image_grid_resizing.sql", import.meta.url), "utf8"));
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

test("migration upgrades old grid config without changing images, headings, logo or gallery", async () => {
  const block = (await db.query("select config from profile_content_blocks where id=$1", [grid])).rows[0];
  assert.deepEqual(block.config, { columns: 2, width_percent: 100, aspect_ratio: 1.5 });
  const rows = (await db.query("select storage_path,alt_text,sort_order from profile_content_block_images where block_id=$1", [grid])).rows;
  assert.deepEqual(rows, [{ storage_path: blockImage, alt_text: "Ansicht", sort_order: 0 }]);
  assert.deepEqual((await db.query("select type,config,content from profile_content_blocks where profile_id=$1 and type in ('heading','text') order by type", [profile])).rows.map(({ type, config, content }) => ({ type, config, content })), [
    { type: "heading", config: {}, content: { text: "Titel" } },
    { type: "text", config: {}, content: { text: "Inhalt" } },
  ]);
  assert.equal((await db.query("select logo_path from company_profiles where id=$1", [profile])).rows[0].logo_path, logo);
  assert.equal((await db.query("select storage_path from company_profile_images where profile_id=$1", [profile])).rows[0].storage_path, gallery);
});

test("new grids start with complete defaults and resize preserves columns and image references", async () => {
  await actor(admin);
  const newId = (await db.query("select insert_profile_content_block($1,'image_grid','',null) as id", [profile])).rows[0].id;
  assert.deepEqual((await db.query("select config from profile_content_blocks where id=$1", [newId])).rows[0].config,
    { columns: 1, width_percent: 100, aspect_ratio: 1.5 });
  await db.query("update profile_content_blocks set config=$1 where id=$2", [{ columns: 2, width_percent: 35, aspect_ratio: 0.6 }, grid]);
  await db.query("update profile_content_blocks set config=$1 where id=$2", [{ columns: 2, width_percent: 100, aspect_ratio: 3 }, grid]);
  assert.deepEqual((await db.query("select id,storage_path,alt_text,sort_order from profile_content_block_images where block_id=$1", [grid])).rows,
    [{ id: image, storage_path: blockImage, alt_text: "Ansicht", sort_order: 0 }]);
  assert.equal((await db.query("select config->>'columns' as columns from profile_content_blocks where id=$1", [grid])).rows[0].columns, "2");
});

test("database rejects out-of-range size, extra keys and invalid heading/text config", async () => {
  await actor(admin);
  for (const config of [
    { columns: 2, width_percent: 34, aspect_ratio: 1.5 },
    { columns: 2, width_percent: 101, aspect_ratio: 1.5 },
    { columns: 2, width_percent: 75, aspect_ratio: 0.59 },
    { columns: 2, width_percent: 75, aspect_ratio: 3.01 },
    { columns: 2, width_percent: 75, aspect_ratio: 1.234 },
    { columns: 2, width_percent: 75, aspect_ratio: 1.5, arbitrary: true },
    { columns: 2, width_percent: "75", aspect_ratio: 1.5 },
  ]) await blocked("update profile_content_blocks set config=$1 where id=$2", [config, grid]);
  const heading = (await db.query("select id from profile_content_blocks where profile_id=$1 and type='heading'", [profile])).rows[0].id;
  await blocked("update profile_content_blocks set config=$1 where id=$2", [{ columns: 1, width_percent: 100, aspect_ratio: 1.5 }, heading]);
});

test("RLS keeps owners, non-admins and anonymous visitors read-only", async () => {
  for (const id of [owner, "22222222-2222-4222-8222-222222222222"]) {
    await actor(id);
    assert.equal((await db.query("update profile_content_blocks set config=$1 where id=$2 returning id", [
      { columns: 2, width_percent: 50, aspect_ratio: 1.2 }, grid,
    ])).rows.length, 0);
  }
  await actor("", "anon");
  assert.equal((await db.query("select config->>'width_percent' as width from profile_content_blocks where id=$1", [grid])).rows[0].width, "100");
  await blocked("update profile_content_blocks set config=$1 where id=$2", [
    { columns: 2, width_percent: 50, aspect_ratio: 1.2 }, grid,
  ]);
});

test("image reorder, replacement, alt, removal and vertical block order still work", async () => {
  await actor(admin);
  const secondPath = `profiles/${profile}/blocks/${grid}/44444444-4444-4444-8444-444444444444.jpg`;
  const replacement = `profiles/${profile}/blocks/${grid}/55555555-5555-4555-8555-555555555555.jpg`;
  const second = (await db.query("insert into profile_content_block_images(block_id,storage_path,sort_order) values ($1,$2,1) returning id", [grid, secondPath])).rows[0].id;
  await db.query("select reorder_profile_block_images($1,$2,$3::uuid[])", [profile, grid, [second, image]]);
  assert.deepEqual((await db.query("select id from profile_content_block_images where block_id=$1 order by sort_order", [grid])).rows.map((row) => row.id), [second, image]);
  await db.query("update profile_content_block_images set storage_path=$1,alt_text='Neue Ansicht' where id=$2", [replacement, second]);
  assert.deepEqual((await db.query("select storage_path,alt_text from profile_content_block_images where id=$1", [second])).rows[0],
    { storage_path: replacement, alt_text: "Neue Ansicht" });
  assert.equal((await db.query("select remove_profile_block_image($1,$2,$3) as path", [profile, grid, second])).rows[0].path, replacement);
  assert.deepEqual((await db.query("select id,sort_order,alt_text from profile_content_block_images where block_id=$1", [grid])).rows,
    [{ id: image, sort_order: 0, alt_text: "Ansicht" }]);
  const ids = (await db.query("select id from profile_content_blocks where profile_id=$1 and slot is null order by sort_order,id", [profile])).rows.map((row) => row.id);
  await db.query("select reorder_profile_content_blocks($1,$2::uuid[])", [profile, [ids[2], ids[0], ids[1]]]);
  assert.deepEqual((await db.query("select id from profile_content_blocks where profile_id=$1 and slot is null order by sort_order,id", [profile])).rows.map((row) => row.id), [ids[2], ids[0], ids[1]]);
  await blocked("update profile_content_blocks set config=$1 where id=$2", [
    { columns: 0, width_percent: 75, aspect_ratio: 1.5 }, grid,
  ]);
  assert.equal((await db.query("select logo_path from company_profiles where id=$1", [profile])).rows[0].logo_path, logo);
  assert.equal((await db.query("select storage_path from company_profile_images where profile_id=$1", [profile])).rows[0].storage_path, gallery);
});

test("resized layout still refuses to shrink below its image count", async () => {
  await actor(admin);
  await db.query("update profile_content_blocks set config=$1 where id=$2", [
    { columns: 4, width_percent: 65, aspect_ratio: 1.25 }, grid,
  ]);
  for (const n of [6, 7]) await db.query(
    "insert into profile_content_block_images(block_id,storage_path,sort_order) values ($1,$2,$3)",
    [grid, `profiles/${profile}/blocks/${grid}/${n}6666666-6666-4666-8666-666666666666.jpg`, n - 5],
  );
  await blocked("update profile_content_blocks set config=$1 where id=$2", [
    { columns: 2, width_percent: 65, aspect_ratio: 1.25 }, grid,
  ]);
  assert.deepEqual((await db.query("select config from profile_content_blocks where id=$1", [grid])).rows[0].config,
    { columns: 4, width_percent: 65, aspect_ratio: 1.25 });
});
