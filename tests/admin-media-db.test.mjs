import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const admin = "33333333-3333-4333-8333-333333333333";
const outsider = "44444444-4444-4444-8444-444444444444";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const first = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const second = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = (id = first, kind = "gallery") => `profiles/${profile}/${kind}/${id}.png`;
let db;

before(async () => {
  db = await createMediaTestDatabase(true);
  // The compact test fixture predates the existing cloud admin profile policy.
  await db.exec(`CREATE POLICY profiles_admin_update ON company_profiles FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM portal_admins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM portal_admins WHERE user_id = auth.uid()));`);
  await db.exec(await readFile(new URL("../supabase/migrations/20260924155258_admin_company_media_editor.sql", import.meta.url), "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Firma','draft')", [profile, owner]);
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
  await db.exec("rollback to savepoint denied; release savepoint denied");
}
async function seedImages() {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query("insert into company_profile_images(id,profile_id,storage_path,sort_order) values ($1,$2,$3,0),($4,$2,$5,1)", [first, profile, path(first), second, path(second)]);
}

test("admin edits another owner's gallery; non-admin cannot mutate it", async () => {
  await seedImages();
  await actor(admin);
  await db.query("update company_profile_images set alt_text='Neuer Alt-Text' where id=$1", [first]);
  await db.query("select reorder_company_images($1,$2::uuid[])", [profile, [second, first]]);
  const { rows } = await db.query("select id,sort_order from company_profile_images where profile_id=$1 order by sort_order", [profile]);
  assert.deepEqual(rows.map((row) => row.id), [second, first]);
  await db.query("delete from company_profile_images where id=$1", [first]);
  assert.equal((await db.query("select id from company_profile_images where id=$1", [first])).rows.length, 0);
  await actor(outsider);
  await blocked("insert into company_profile_images(profile_id,storage_path) values ($1,$2)", [profile, path(first)]);
  assert.equal((await db.query("update company_profile_images set alt_text='x' where id=$1", [second])).affectedRows, 0);
  await blocked("select reorder_company_images($1,$2::uuid[])", [profile, [second]]);
});

test("existing owner gallery access remains available and reordering rejects foreign/incomplete IDs", async () => {
  await seedImages();
  await actor(owner);
  await db.query("select reorder_company_images($1,$2::uuid[])", [profile, [second, first]]);
  await blocked("select reorder_company_images($1,$2::uuid[])", [profile, [first]]);
  await blocked("select reorder_company_images($1,$2::uuid[])", [profile, [first, outsider]]);
});

test("admin gallery edits preserve the approval and category of a published profile", async () => {
  await actor(owner);
  await db.query("update company_profiles set status='pending' where id=$1", [profile]);
  await actor(admin);
  await db.query("select review_company_profile_with_categories($1,'approved',array['heizung'])", [profile]);
  const initial = (await db.query("select status,approved_at from company_profiles where id=$1", [profile])).rows[0];
  assert.equal(initial.status, "approved");
  await db.query("insert into company_profile_images(profile_id,storage_path,alt_text) values ($1,$2,'Ansicht')", [profile, path(first)]);
  assert.deepEqual((await db.query("select status,approved_at from company_profiles where id=$1", [profile])).rows[0], initial);
  assert.deepEqual((await db.query("select category_id from company_profile_categories where profile_id=$1", [profile])).rows, [{ category_id: "heizung" }]);
});

test("admin Storage rights stay inside valid profile paths; referenced files cannot be deleted", async () => {
  await actor(admin);
  await db.query("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [path(first)]);
  await blocked("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [`profiles/${outsider}/gallery/${second}.png`]);
  await blocked("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [`profiles/${profile}/other/${second}.png`]);
  await blocked("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [`profiles/${profile}/gallery/${second}.svg`]);
  assert.equal((await db.query("update storage.objects set name=$1 where name=$2", [path(second), path(first)])).affectedRows, 0);
  await db.exec("reset role");
  await db.query("insert into company_profile_images(id,profile_id,storage_path) values ($1,$2,$3)", [first, profile, path(first)]);
  await actor(admin);
  assert.equal((await db.query("delete from storage.objects where name=$1", [path(first)])).affectedRows, 0);
  await db.query("delete from company_profile_images where id=$1", [first]);
  await db.query("delete from storage.objects where name=$1", [path(first)]);
  assert.equal((await db.query("select name from storage.objects where name=$1", [path(first)])).rows.length, 0);
  await actor(outsider);
  await blocked("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [path(second)]);
  await actor("", "anon");
  await blocked("insert into storage.objects(bucket_id,name) values ('company-media',$1)", [path(second)]);
});
