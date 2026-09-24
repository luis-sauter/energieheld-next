import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const pending = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let db;

before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create policy profiles_admin_update on company_profiles for update to authenticated using (exists(select 1 from portal_admins where user_id=auth.uid())) with check (exists(select 1 from portal_admins where user_id=auth.uid()))");
  for (const file of [
    "20260924155258_admin_company_media_editor.sql",
    "20260924171344_profile_content_blocks.sql",
    "20260924202803_profile_image_grid_blocks.sql",
  ]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  for (const id of [profile, foreign, pending])
    await db.query("insert into company_profiles(id,company_id,display_name,status,description,business_areas) values ($1,$2,'Firma','pending','Bestehende Beschreibung','Bestehende Tätigkeiten')", [id, owner]);
  for (const id of [profile, foreign]) {
    await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'heizung')", [id]);
    await db.query("update company_profiles set status='approved' where id=$1", [id]);
  }
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
async function block(target = profile, type = "image_grid", text = "") {
  return (await db.query("select insert_profile_content_block($1,$2,$3,null) as id", [target, type, text])).rows[0].id;
}
function path(target, blockId, n) {
  return `profiles/${target}/blocks/${blockId}/${String(n).padStart(8, "0")}-0000-4000-8000-000000000000.jpg`;
}
async function image(blockId, target, n) {
  return (await db.query("insert into profile_content_block_images(block_id,storage_path,sort_order) values ($1,$2,$3) returning id", [blockId, path(target, blockId, n), n - 1])).rows[0].id;
}

test("admin inserts image grids at the requested position while text and headings remain valid", async () => {
  await actor(admin);
  const first = await block(profile, "heading", "Erster Abschnitt");
  const last = await block(profile, "text", "Bestehender Text");
  const middle = (await db.query("select insert_profile_content_block($1,'image_grid','',$2) as id", [profile, last])).rows[0].id;
  const rows = (await db.query("select id,type,content,config from profile_content_blocks where profile_id=$1 order by sort_order,id", [profile])).rows;
  assert.deepEqual(rows.map((row) => row.id), [first, middle, last]);
  assert.deepEqual(rows[1].content, {});
  assert.deepEqual(rows[1].config, { columns: 1 });
  await db.query("select reorder_profile_content_blocks($1,$2::uuid[])", [profile, [middle, first, last]]);
  assert.deepEqual((await db.query("select id from profile_content_blocks where profile_id=$1 order by sort_order,id", [profile])).rows.map((row) => row.id), [middle, first, last]);
  await blocked("insert into profile_content_blocks(profile_id,type,content,config) values ($1,'image_grid','{}','{}')", [profile]);
  await blocked("insert into profile_content_blocks(profile_id,type,content,config) values ($1,'image_grid','{}','{\"columns\":5}')", [profile]);
});

test("non-admins cannot create or mutate blocks and images; public reads require approval", async () => {
  await actor(admin);
  const published = await block();
  await db.query("update profile_content_blocks set config='{\"columns\":2}' where id=$1", [published]);
  const imageId = await image(published, profile, 1);
  await actor(owner);
  await blocked("select insert_profile_content_block($1,'image_grid','',null)", [profile]);
  await blocked("insert into profile_content_block_images(block_id,storage_path) values ($1,$2)", [published, path(profile, published, 2)]);
  assert.equal((await db.query("update profile_content_block_images set alt_text='hack' where id=$1 returning id", [imageId])).rows.length, 0);
  await actor("", "anon");
  assert.deepEqual((await db.query("select id from profile_content_block_images")).rows.map((row) => row.id), [imageId]);
  await blocked("delete from profile_content_block_images where id=$1", [imageId]);
  await db.exec("reset role");
  const hidden = await db.query("insert into profile_content_blocks(profile_id,type,content,config) values ($1,'image_grid','{}','{\"columns\":1}') returning id", [pending]);
  await image(hidden.rows[0].id, pending, 3);
  await actor("", "anon");
  assert.deepEqual((await db.query("select id from profile_content_block_images")).rows.map((row) => row.id), [imageId]);
});

test("1–4 images, path isolation, layout guard and fifth-image limit are enforced in SQL", async () => {
  await actor(admin);
  const id = await block();
  await db.query("update profile_content_blocks set config='{\"columns\":4}' where id=$1", [id]);
  for (let n = 1; n <= 4; n++) await image(id, profile, n);
  assert.equal((await db.query("select count(*)::int as n from profile_content_block_images where block_id=$1", [id])).rows[0].n, 4);
  await blocked("insert into profile_content_block_images(block_id,storage_path) values ($1,$2)", [id, path(profile, id, 5)]);
  await blocked("update profile_content_blocks set config='{\"columns\":2}' where id=$1", [id]);
  await blocked("insert into profile_content_block_images(block_id,storage_path) values ($1,$2)", [id, path(foreign, id, 6)]);
  const other = await block(foreign);
  await blocked("insert into profile_content_block_images(block_id,storage_path) values ($1,$2)", [other, path(profile, other, 7)]);
});

test("horizontal reorder checks exact membership; delete renumbers and cascade removes references", async () => {
  await actor(admin);
  const id = await block();
  await db.query("update profile_content_blocks set config='{\"columns\":3}' where id=$1", [id]);
  const ids = [];
  for (let n = 1; n <= 3; n++) ids.push(await image(id, profile, n));
  const foreignBlock = await block(foreign);
  const foreignImage = await image(foreignBlock, foreign, 8);
  await blocked("select reorder_profile_block_images($1,$2,$3::uuid[])", [profile, id, [ids[0], ids[0], ids[2]]]);
  await blocked("select reorder_profile_block_images($1,$2,$3::uuid[])", [profile, id, [ids[0], foreignImage, ids[2]]]);
  await blocked("select reorder_profile_block_images($1,$2,$3::uuid[])", [foreign, id, ids]);
  await db.query("select reorder_profile_block_images($1,$2,$3::uuid[])", [profile, id, [ids[2], ids[0], ids[1]]]);
  assert.deepEqual((await db.query("select id from profile_content_block_images where block_id=$1 order by sort_order", [id])).rows.map((row) => row.id), [ids[2], ids[0], ids[1]]);
  assert.equal((await db.query("select remove_profile_block_image($1,$2,$3) as path", [profile, id, ids[0]])).rows[0].path, path(profile, id, 1));
  assert.deepEqual((await db.query("select sort_order from profile_content_block_images where block_id=$1 order by sort_order", [id])).rows.map((row) => row.sort_order), [0, 1]);
  await blocked("select remove_profile_block_image($1,$2,$3)", [profile, id, foreignImage]);
  await db.query("delete from profile_content_blocks where id=$1", [id]);
  assert.equal((await db.query("select count(*)::int as n from profile_content_block_images where block_id=$1", [id])).rows[0].n, 0);
});

test("private Storage allows only valid admin block uploads and referenced approved public reads", async () => {
  await actor(admin);
  const id = await block();
  const objectPath = path(profile, id, 1);
  await db.query("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [objectPath]);
  await actor(owner);
  await blocked("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [path(profile, id, 2)]);
  assert.equal((await db.query("select count(*)::int as n from storage.objects where name=$1", [objectPath])).rows[0].n, 0);
  await actor("", "anon");
  assert.equal((await db.query("select count(*)::int as n from storage.objects where name=$1", [objectPath])).rows[0].n, 0);
  await actor(admin);
  const imageId = await image(id, profile, 1);
  await db.exec("reset role");
  const hidden = (await db.query("insert into profile_content_blocks(profile_id,type,content,config) values ($1,'image_grid','{}','{\"columns\":1}') returning id", [pending])).rows[0].id;
  const hiddenPath = path(pending, hidden, 9);
  await image(hidden, pending, 9);
  await db.query("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [hiddenPath]);
  await actor("", "anon");
  assert.equal((await db.query("select count(*)::int as n from storage.objects where name=$1", [objectPath])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from storage.objects where name=$1", [hiddenPath])).rows[0].n, 0);
  await actor(admin);
  assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [objectPath])).rows.length, 0);
  await db.query("select remove_profile_block_image($1,$2,$3)", [profile, id, imageId]);
  assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [objectPath])).rows.length, 1);
});
