import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const admin = "33333333-3333-4333-8333-333333333333";
const owner = "11111111-1111-4111-8111-111111111111";
const outsider = "44444444-4444-4444-8444-444444444444";
const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"];
const pending = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const added = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
let db;
const read = (file) => readFile(new URL(file, import.meta.url), "utf8");

before(async () => {
  db = new PGlite();
  await db.exec(await read("./fixtures/company-schema.sql"));
  await db.exec("grant select (id,status) on company_profiles to anon");
  await db.exec(`CREATE POLICY profiles_admin_update ON company_profiles FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM portal_admins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM portal_admins WHERE user_id = auth.uid()));`);
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$2,'Firma')", [owner, owner]);
  for (const id of [ids[2], ids[0], ids[1]])
    await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Firma','approved')", [id, owner]);
  await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Entwurf','pending')", [pending, owner]);
  await db.exec(await read("../supabase/migrations/20260925091403_company_directory_order.sql"));
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
const ordered = () => db.query("select profile_id,sort_order from company_directory_order order by sort_order,profile_id");
const reorder = (values) => db.query("select reorder_company_directory_profiles($1::uuid[])", [values]);

test("table has RLS, nonnegative positions and deterministic approved-only initialization", async () => {
  const meta = await db.query("select relrowsecurity from pg_class where oid='public.company_directory_order'::regclass");
  assert.equal(meta.rows[0].relrowsecurity, true);
  assert.deepEqual((await ordered()).rows, ids.map((id, sort_order) => ({ profile_id: id, sort_order })));
  for (const role of ["anon", "authenticated"])
    for (const column of ["profile_id", "sort_order", "updated_at"])
      assert.equal((await db.query("select has_column_privilege($1,'public.company_directory_order',$2,'SELECT') as allowed", [role, column])).rows[0].allowed, true);
  for (const privilege of ["INSERT", "UPDATE", "DELETE"])
    assert.equal((await db.query("select has_table_privilege('anon','public.company_directory_order',$1) as allowed", [privilege])).rows[0].allowed, false);
  assert.equal((await db.query("select has_column_privilege('authenticated','public.company_directory_order','sort_order','UPDATE') as allowed")).rows[0].allowed, true);
  assert.equal((await db.query("select has_table_privilege('authenticated','public.company_directory_order','DELETE') as allowed")).rows[0].allowed, false);
  await blocked("insert into company_directory_order(profile_id,sort_order) values ($1,-1)", [pending]);
});

test("public reads only approved positions; anon, owners and other users cannot write or execute RPC", async () => {
  await db.query("insert into company_directory_order(profile_id,sort_order) values ($1,9)", [pending]);
  await actor(outsider, "anon");
  assert.deepEqual((await ordered()).rows.map((row) => row.profile_id), ids);
  await blocked("insert into company_directory_order(profile_id,sort_order) values ($1,8)", [added]);
  await blocked(reorderSql, [ids]);
  for (const user of [owner, outsider]) {
    await actor(user);
    assert.equal((await db.query("update company_directory_order set sort_order=8 where profile_id=$1", [ids[0]])).affectedRows, 0);
    await blocked(reorderSql, [ids]);
  }
  await actor(admin);
  assert.deepEqual((await ordered()).rows.map((row) => row.profile_id), [...ids, pending]);
});

const reorderSql = "select reorder_company_directory_profiles($1::uuid[])";
test("admin can reorder atomically; incomplete, duplicate, extra, pending and foreign IDs fail", async () => {
  await actor(admin);
  assert.deepEqual((await ordered()).rows.map((row) => row.profile_id), ids);
  for (const invalid of [null, [ids[0]], [ids[0], ids[0], ids[2]], [...ids, outsider], [ids[0], ids[1], pending], [ids[0], ids[1], outsider]]) {
    await blocked(reorderSql, [invalid]);
    assert.deepEqual((await ordered()).rows.map((row) => row.profile_id), ids);
  }
  await reorder([ids[2], ids[0], ids[1]]);
  assert.deepEqual((await ordered()).rows, [ids[2], ids[0], ids[1]].map((id, sort_order) => ({ profile_id: id, sort_order })));
});

test("newly approved profile has no row, then receives the final position on next save", async () => {
  await db.query("insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Neu','approved')", [added, owner]);
  await actor(admin);
  assert.equal((await ordered()).rows.length, 3);
  await reorder([...ids, added]);
  assert.deepEqual((await ordered()).rows.at(-1), { profile_id: added, sort_order: 3 });
});
