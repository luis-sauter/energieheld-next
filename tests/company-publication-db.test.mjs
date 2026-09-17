import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const path = (kind, n = 1) =>
  `profiles/${profile}/${kind}/00000000-0000-4000-8000-${String(n).padStart(12, "0")}.png`;
let db;
before(async () => {
  db = await createMediaTestDatabase(true);
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  await db.query(
    "insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Firma','pending')",
    [profile, owner],
  );
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
async function approve() {
  await actor(admin);
  await db.query(
    "select review_company_profile_with_categories($1,'approved',array['heizung'])",
    [profile],
  );
}
async function snapshot() {
  return (
    await db.query(
      "select status,approved_at from company_profiles where id=$1",
      [profile],
    )
  ).rows[0];
}
test("published profile remains approved with approval timestamp after text/logo/gallery edits", async () => {
  await approve();
  await actor(owner);
  const initial = await snapshot();
  assert.equal(initial.status, "approved");
  assert.ok(initial.approved_at);
  await db.query("update company_profiles set display_name='Neu' where id=$1", [
    profile,
  ]);
  for (const p of [path("logo"), path("logo", 2), null]) {
    await db.query("update company_profiles set logo_path=$1 where id=$2", [
      p,
      profile,
    ]);
    assert.deepEqual(await snapshot(), initial);
  }
  const ids = [];
  for (let i = 0; i < 2; i++)
    ids.push(
      (
        await db.query(
          "insert into company_profile_images(profile_id,storage_path,sort_order) values ($1,$2,$3) returning id",
          [profile, path("gallery", i), i],
        )
      ).rows[0].id,
    );
  await db.query("select reorder_company_images($1,$2::uuid[])", [
    profile,
    ids.reverse(),
  ]);
  assert.deepEqual(await snapshot(), initial);
  assert.deepEqual(
    (
      await db.query(
        "select id from company_profile_images order by sort_order",
      )
    ).rows.map((r) => r.id),
    ids,
  );
  await db.query("delete from company_profile_images where id=$1", [ids[0]]);
  assert.deepEqual(await snapshot(), initial);
  assert.deepEqual(
    (await db.query("select category_id from company_profile_categories")).rows,
    [{ category_id: "heizung" }],
  );
});
test("owner cannot self-approve, forge approval timestamp or write official categories", async () => {
  await actor(owner);
  await blocked("update company_profiles set status='approved' where id=$1", [
    profile,
  ]);
  await blocked("update company_profiles set approved_at=now() where id=$1", [
    profile,
  ]);
  await blocked(
    "insert into company_profile_categories values ($1,'solar',now())",
    [profile],
  );
  await blocked("delete from company_profile_categories where profile_id=$1", [
    profile,
  ]);
  await blocked("select set_company_profile_categories($1,array['solar'])", [
    profile,
  ]);
  await approve();
  await actor(owner);
  await blocked("update company_profiles set status='draft' where id=$1", [
    profile,
  ]);
});
test("initial publication still requires admin categories; admin can change categories on a published profile", async () => {
  await actor(admin);
  await blocked(
    "select review_company_profile_with_categories($1,'approved',array[]::text[])",
    [profile],
  );
  await approve();
  const initial = await snapshot();
  await db.query(
    "select set_company_profile_categories($1,array['daemmung','fassade'])",
    [profile],
  );
  assert.deepEqual(await snapshot(), initial);
  assert.deepEqual(
    (
      await db.query(
        "select category_id from company_profile_categories order by category_id",
      )
    ).rows.map((r) => r.category_id),
    ["daemmung", "fassade"],
  );
  await blocked("select set_company_profile_categories($1,array[]::text[])", [
    profile,
  ]);
  await blocked("select set_company_profile_categories($1,array['fake'])", [
    profile,
  ]);
  await actor("", "anon");
  await blocked("select set_company_profile_categories($1,array['solar'])", [
    profile,
  ]);
});
test("new trigger retains gallery cap, ownership and path restrictions", async () => {
  await approve();
  await actor(owner);
  for (let i = 0; i < 8; i++)
    await db.query(
      "insert into company_profile_images(profile_id,storage_path) values ($1,$2)",
      [profile, path("gallery", i)],
    );
  await blocked(
    "insert into company_profile_images(profile_id,storage_path) values ($1,$2)",
    [profile, path("gallery", 9)],
  );
  await blocked(
    "insert into company_profile_images(profile_id,storage_path) values ($1,$2)",
    [profile, "https://example.org/file.png"],
  );
  await actor(other);
  assert.equal(
    (
      await db.query(
        "update company_profile_images set sort_order=7 returning id",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await db.query("delete from company_profile_images returning id")).rows
      .length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "update company_profiles set logo_path=null where id=$1 returning id",
        [profile],
      )
    ).rows.length,
    0,
  );
});
test("private storage reference checks survive, and replacements become public without re-review", async () => {
  await approve();
  await actor(owner);
  for (const p of [path("logo"), path("logo", 2), path("gallery")])
    await db.query(
      "insert into storage.objects(bucket_id,name) values ('company-media',$1)",
      [p],
    );
  await db.query("update company_profiles set logo_path=$1 where id=$2", [
    path("logo"),
    profile,
  ]);
  await actor("", "anon");
  assert.deepEqual((await db.query("select name from storage.objects")).rows, [
    { name: path("logo") },
  ]);
  await actor(owner);
  await db.query("update company_profiles set logo_path=$1 where id=$2", [
    path("logo", 2),
    profile,
  ]);
  await actor("", "anon");
  assert.deepEqual((await db.query("select name from storage.objects")).rows, [
    { name: path("logo", 2) },
  ]);
  assert.equal(
    (
      await db
        .query("select public from storage.buckets where id='company-media'")
        .catch(() => ({ rows: [] }))
    ).rows.length,
    0,
  );
});
