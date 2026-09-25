import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const block = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const image = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = `profiles/${profile}/blocks/${block}/33333333-3333-4333-8333-333333333333.jpg`;
const pendingProfile = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const pendingBlock = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const pendingImage = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const pendingPath = `profiles/${pendingProfile}/blocks/${pendingBlock}/55555555-5555-4555-8555-555555555555.jpg`;
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
  await db.query("insert into company_profiles(id,company_id,display_name,status,description,business_areas) values ($1,$2,'Firma','pending','Beschreibung','Bereich')", [profile, owner]);
  await db.query("insert into company_profile_categories(profile_id,category_id) values ($1,'heizung')", [profile]);
  await db.query("update company_profiles set status='approved' where id=$1", [profile]);
  await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values ($1,$2,'image_grid','{}','{\"columns\":2}')", [block, profile]);
  await db.query("insert into profile_content_block_images(id,block_id,storage_path,alt_text,sort_order) values ($1,$2,$3,'Ansicht',0)", [image, block, path]);
  await db.query("insert into company_profiles(id,company_id,display_name,status,description,business_areas) values ($1,$2,'Entwurf','pending','Beschreibung','Bereich')", [pendingProfile, owner]);
  await db.query("insert into profile_content_blocks(id,profile_id,type,content,config) values ($1,$2,'image_grid','{}','{\"columns\":1}')", [pendingBlock, pendingProfile]);
  await db.query("insert into profile_content_block_images(id,block_id,storage_path,alt_text,sort_order) values ($1,$2,$3,'Nicht freigegeben',0)", [pendingImage, pendingBlock, pendingPath]);
  for (const file of ["20260924210916_profile_image_grid_resizing.sql",
    "20260924214027_universal_content_block_layout.sql",
    "20260924220748_image_crop_focus_zoom.sql",
    "20260925083617_profile_block_image_captions.sql"])
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
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

test("migration gives existing images safe defaults without changing identity, path, alt or order", async () => {
  const row = (await db.query("select id,block_id,storage_path,alt_text,sort_order,focus_x,focus_y,zoom from profile_content_block_images where id=$1", [image])).rows[0];
  assert.deepEqual(row, { id: image, block_id: block, storage_path: path,
    alt_text: "Ansicht", sort_order: 0, focus_x: "50", focus_y: "50", zoom: "1" });
});

test("caption migration backfills old alt text without changing path, order or crop", async () => {
  const row = (await db.query("select caption,alt_text,storage_path,sort_order,focus_x,focus_y,zoom from profile_content_block_images where id=$1", [image])).rows[0];
  assert.deepEqual(row, { caption: "Ansicht", alt_text: "Ansicht", storage_path: path,
    sort_order: 0, focus_x: "50", focus_y: "50", zoom: "1" });
  const { rows } = await db.query("select a.attname, pg_get_userbyid(acl.grantee) as role_name, acl.privilege_type from pg_attribute a cross join lateral aclexplode(a.attacl) acl where a.attrelid='public.profile_content_block_images'::regclass and a.attname='caption'");
  for (const role of ["anon", "authenticated"])
    assert.ok(rows.some((item) => item.role_name === role && item.privilege_type === "SELECT"));
  assert.ok(rows.some((item) => item.role_name === "authenticated" && item.privilege_type === "UPDATE"));
  assert.ok(!rows.some((item) => item.role_name === "anon" && item.privilege_type === "UPDATE"));
});

test("public reads approved captions but cannot edit; only an admin can update them", async () => {
  await actor("", "anon");
  assert.deepEqual((await db.query("select id,caption from profile_content_block_images order by id")).rows,
    [{ id: image, caption: "Ansicht" }]);
  await blocked("update profile_content_block_images set caption='Fremd' where id=$1", [image]);
  await actor(owner);
  assert.equal((await db.query("update profile_content_block_images set caption='Fremd' where id=$1 returning id", [image])).rows.length, 0);
  await actor(admin);
  await db.query("update profile_content_block_images set caption='Neue Wärmepumpe' where id=$1", [image]);
  assert.equal((await db.query("select caption from profile_content_block_images where id=$1", [image])).rows[0].caption, "Neue Wärmepumpe");
  await blocked("update profile_content_block_images set caption=$1 where id=$2", ["x".repeat(501), image]);
});

test("four captions stay with their images through reorder and crop", async () => {
  await actor(admin);
  await db.query("update profile_content_blocks set config=config || '{\"columns\":4}'::jsonb where id=$1", [block]);
  const ids = [image];
  const captions = ["Bild eins", "Bild zwei", "Bild drei", "Bild vier"];
  await db.query("update profile_content_block_images set caption=$1 where id=$2", [captions[0], image]);
  for (let n = 1; n < 4; n++) {
    const added = (await db.query("insert into profile_content_block_images(block_id,storage_path,alt_text,sort_order) values ($1,$2,null,$3) returning id", [
      block, `profiles/${profile}/blocks/${block}/0000000${n}-0000-4000-8000-000000000000.jpg`, n,
    ])).rows[0];
    await db.query("update profile_content_block_images set caption=$1 where id=$2", [captions[n], added.id]);
    ids.push(added.id);
  }
  await db.query("select reorder_profile_block_images($1,$2,$3::uuid[])", [profile, block, [ids[3], ids[0], ids[1], ids[2]]]);
  await db.query("update profile_content_block_images set focus_x=25,focus_y=70,zoom=1.5 where id=$1", [ids[2]]);
  const rows = (await db.query("select id,caption from profile_content_block_images where block_id=$1 order by sort_order", [block])).rows;
  assert.deepEqual(rows, [[ids[3], captions[3]], [ids[0], captions[0]], [ids[1], captions[1]], [ids[2], captions[2]]]
    .map(([id, caption]) => ({ id, caption })));
});

test("crop columns explicitly grant SELECT to anon and authenticated, but UPDATE only to authenticated", async () => {
  const columns = ["focus_x", "focus_y", "zoom"];
  const { rows } = await db.query(`
    select a.attname as column_name, pg_get_userbyid(acl.grantee) as role_name,
      acl.privilege_type
    from pg_attribute a cross join lateral aclexplode(a.attacl) acl
    where a.attrelid = 'public.profile_content_block_images'::regclass
      and a.attname = any($1::text[])
  `, [columns]);
  for (const column of columns) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query(
        "select has_column_privilege($1, 'public.profile_content_block_images', $2, 'SELECT') as allowed",
        [role, column])).rows[0].allowed, true);
      assert.ok(rows.some((row) => row.column_name === column && row.role_name === role && row.privilege_type === "SELECT"),
        `${role} needs an explicit SELECT grant on ${column}`);
    }
    for (const [role, allowed] of [["anon", false], ["authenticated", true]]) {
      assert.equal((await db.query(
        "select has_column_privilege($1, 'public.profile_content_block_images', $2, 'UPDATE') as allowed",
        [role, column])).rows[0].allowed, allowed);
      assert.equal(rows.some((row) => row.column_name === column && row.role_name === role && row.privilege_type === "UPDATE"), allowed);
    }
  }
});

test("SELECT * reads approved images for visitors and admins while public RLS hides pending images", async () => {
  for (const [id, role] of [["", "anon"], [owner, "authenticated"]]) {
    await actor(id, role);
    const { rows } = await db.query("select * from profile_content_block_images order by id");
    assert.deepEqual(rows.map((row) => row.id), [image]);
    assert.equal(rows[0].focus_x, "50");
    assert.equal(rows[0].focus_y, "50");
    assert.equal(rows[0].zoom, "1");
    assert.equal((await db.query("select * from profile_content_block_images where id=$1", [pendingImage])).rows.length, 0);
  }
  await actor(admin);
  const { rows } = await db.query("select * from profile_content_block_images order by id");
  assert.deepEqual(rows.map((row) => row.id), [image, pendingImage]);
  assert.deepEqual(rows.map((row) => [row.focus_x, row.focus_y, row.zoom]), [["50", "50", "1"], ["50", "50", "1"]]);
});

test("crop constraints accept bounds and one/two decimal precision, rejecting invalid values", async () => {
  await actor(admin);
  await db.query("update profile_content_block_images set focus_x=0,focus_y=100,zoom=3 where id=$1", [image]);
  await db.query("update profile_content_block_images set focus_x=100,focus_y=0,zoom=1 where id=$1", [image]);
  await db.query("update profile_content_block_images set focus_x=37.5,focus_y=62.5,zoom=1.25 where id=$1", [image]);
  for (const [column, value] of [
    ["focus_x", -0.1], ["focus_x", 100.1], ["focus_x", 12.34],
    ["focus_y", -0.1], ["focus_y", 100.1], ["focus_y", 12.34],
    ["zoom", 0.99], ["zoom", 3.01], ["zoom", 1.234],
  ]) await blocked(`update profile_content_block_images set ${column}=$1 where id=$2`, [value, image]);
  for (const value of ["NaN", "Infinity", "-Infinity"])
    await blocked("update profile_content_block_images set zoom=$1::numeric where id=$2", [value, image]);
});

test("existing RLS and column grants permit only admin crop changes; public can read approved values", async () => {
  for (const id of [owner, "22222222-2222-4222-8222-222222222222"]) {
    await actor(id);
    assert.equal((await db.query("update profile_content_block_images set focus_x=20 where id=$1 returning id", [image])).rows.length, 0);
  }
  await actor("", "anon");
  assert.deepEqual((await db.query("select focus_x,focus_y,zoom from profile_content_block_images where id=$1", [image])).rows[0],
    { focus_x: "50", focus_y: "50", zoom: "1" });
  await blocked("update profile_content_block_images set focus_x=20 where id=$1", [image]);
  await actor(admin);
  await db.query("update profile_content_block_images set focus_x=20,focus_y=70,zoom=1.8 where id=$1", [image]);
  await blocked("update profile_content_block_images set block_id=$1 where id=$2", [profile, image]);
  assert.deepEqual((await db.query("select storage_path,alt_text,sort_order from profile_content_block_images where id=$1", [image])).rows[0],
    { storage_path: path, alt_text: "Ansicht", sort_order: 0 });
});

test("reorder and block layout changes preserve per-image crop metadata", async () => {
  await actor(admin);
  const secondPath = `profiles/${profile}/blocks/${block}/44444444-4444-4444-8444-444444444444.jpg`;
  const second = (await db.query("insert into profile_content_block_images(block_id,storage_path,sort_order) values ($1,$2,1) returning id", [block, secondPath])).rows[0].id;
  assert.deepEqual((await db.query("select focus_x,focus_y,zoom from profile_content_block_images where id=$1", [second])).rows[0],
    { focus_x: "50", focus_y: "50", zoom: "1" });
  await db.query("update profile_content_block_images set focus_x=30,focus_y=60,zoom=1.5 where id=$1", [image]);
  await db.query("select reorder_profile_block_images($1,$2,$3::uuid[])", [profile, block, [second, image]]);
  await db.query("update profile_content_blocks set config=$1 where id=$2", [
    { columns: 2, width_percent: 70, offset_percent: 15, aspect_ratio: 1.2,
      spacing_top: "large", spacing_bottom: "small" }, block]);
  assert.deepEqual((await db.query("select sort_order,focus_x,focus_y,zoom from profile_content_block_images where id=$1", [image])).rows[0],
    { sort_order: 1, focus_x: "30", focus_y: "60", zoom: "1.5" });
  assert.deepEqual((await db.query("select focus_x,focus_y,zoom from profile_content_block_images where id=$1", [second])).rows[0],
    { focus_x: "50", focus_y: "50", zoom: "1" });
});
