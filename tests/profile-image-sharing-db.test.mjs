import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const block = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const foreignBlock = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const image = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = `profiles/${profile}/blocks/${block}/66666666-6666-4666-8666-666666666666.jpg`;
let db;

before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create policy profiles_admin_update on company_profiles for update to authenticated using (exists(select 1 from portal_admins where user_id=auth.uid())) with check (exists(select 1 from portal_admins where user_id=auth.uid()))");
  for (const file of ["20260924155258_admin_company_media_editor.sql",
    "20260924171344_profile_content_blocks.sql", "20260924202803_profile_image_grid_blocks.sql",
    "20260924210916_profile_image_grid_resizing.sql", "20260924214027_universal_content_block_layout.sql",
    "20260924220748_image_crop_focus_zoom.sql", "20260925083617_profile_block_image_captions.sql",
    "20260929120000_share_profile_block_images.sql"])
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  for (const id of [profile, foreign]) {
    await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Firma','pending')", [id, owner]);
    await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'heizung')", [id]);
    await db.query("update company_profiles set status='approved' where id=$1", [id]);
  }
  for (const [id, target] of [[block, profile], [foreignBlock, foreign]])
    await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values ($1,$2,'image_grid','{}','{\"columns\":1,\"width_percent\":100,\"offset_percent\":0,\"aspect_ratio\":1.5,\"spacing_top\":\"normal\",\"spacing_bottom\":\"normal\"}')", [id, target]);
  await db.query("insert into profile_content_block_images(id,block_id,storage_path,alt_text,sort_order) values ($1,$2,$3,'Ansicht',0)", [image, block, path]);
  await db.query("update profile_content_block_images set focus_x=30,focus_y=65,zoom=1.5,caption='Aussicht' where id=$1", [image]);
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function blocked(sql, params) {
  await db.exec("savepoint denied");
  await assert.rejects(db.query(sql, params));
  await db.exec("rollback to savepoint denied; release savepoint denied");
}

test("duplicate RPC shares one path without a Storage copy and preserves crop, caption and alt", async () => {
  await db.exec("set local role authenticated");
  const copy = (await db.query("select public.duplicate_profile_content_block($1,$2) as id", [profile, block])).rows[0].id;
  const rows = (await db.query("select block_id,storage_path,alt_text,caption,focus_x,focus_y,zoom from profile_content_block_images where block_id in ($1,$2) order by block_id", [block, copy])).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].storage_path, rows[1].storage_path);
  for (const row of rows) assert.deepEqual([row.alt_text, row.caption, row.focus_x, row.focus_y, row.zoom],
    ["Ansicht", "Aussicht", "30", "65", "1.5"]);
  assert.equal((await db.query("select count(*)::int as n from storage.objects")).rows[0].n, 0);
  const replacement = `profiles/${profile}/blocks/${copy}/77777777-7777-4777-8777-777777777777.jpg`;
  await db.query("update profile_content_block_images set storage_path=$1,focus_x=80 where block_id=$2", [replacement, copy]);
  assert.equal((await db.query("select storage_path,focus_x from profile_content_block_images where id=$1", [image])).rows[0].storage_path, path);
  assert.equal((await db.query("select focus_x from profile_content_block_images where id=$1", [image])).rows[0].focus_x, "30");
});

test("a shared path cannot be attached to a different profile", async () => {
  await db.exec("set local role authenticated");
  await blocked("insert into profile_content_block_images(block_id,storage_path,sort_order) values ($1,$2,0)", [foreignBlock, path]);
});

test("only the admin can duplicate and a forged profile cannot copy a foreign block", async () => {
  await db.exec("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await blocked("select public.duplicate_profile_content_block($1,$2)", [profile, block]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [admin]);
  await blocked("select public.duplicate_profile_content_block($1,$2)", [foreign, block]);
});

test("a duplicate remains publicly readable after the original block is deleted", async () => {
  await db.exec("set local role authenticated");
  const copy = (await db.query("select public.duplicate_profile_content_block($1,$2) as id", [profile, block])).rows[0].id;
  await db.query("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [path]);
  await db.query("delete from profile_content_block_images where id=$1", [image]);
  await db.query("delete from profile_content_blocks where id=$1", [block]);
  await db.exec("set local role anon");
  const rows = (await db.query("select storage_path from profile_content_block_images where block_id=$1", [copy])).rows;
  assert.deepEqual(rows, [{ storage_path: path }]);
  assert.equal((await db.query("select count(*)::int as n from storage.objects where name=$1", [path])).rows[0].n, 1);
  await db.exec("set local role authenticated");
  assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [path])).rows.length, 0);
  await db.query("delete from profile_content_block_images where block_id=$1", [copy]);
  await db.query("delete from profile_content_blocks where id=$1", [copy]);
  assert.equal((await db.query("delete from storage.objects where name=$1 returning id", [path])).rows.length, 1);
});
