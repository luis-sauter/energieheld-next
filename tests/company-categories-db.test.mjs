import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import "./helpers/load-ts.mjs";
const { energieheld } = await import("../src/config/energieheld.ts");

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const migration = new URL(
  "../supabase/migrations/20260916145904_add_company_categories_and_admin_assignment.sql",
  import.meta.url,
);
let db;
before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(
      new URL("./fixtures/company-schema.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(await readFile(migration, "utf8"));
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query(
    "insert into companies values ($1,$1,'Owner'),($2,$2,'Other')",
    [owner, other],
  );
  await db.query(
    "insert into company_profiles(id,company_id,display_name,status,business_areas) values ($1,$2,'Owner','pending','WDVS'),($3,$4,'Other','pending','Solar')",
    [profile, owner, foreign, other],
  );
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});

async function actor(id = "", role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function review(
  id = profile,
  decision = "approved",
  categories = ["daemmung"],
) {
  return db.query(
    "select review_company_profile_with_categories($1,$2,$3::text[]) as decision",
    [id, decision, categories],
  );
}
async function blocked(sql, params = [], pattern) {
  await db.exec("savepoint denied_operation");
  await assert.rejects(db.query(sql, params), pattern);
  await db.exec(
    "rollback to savepoint denied_operation; release savepoint denied_operation",
  );
}
const rpcSql =
  "select review_company_profile_with_categories($1,$2,$3::text[])";

test("migration DB allowlist exactly matches all canonical Energieheld categories", async () => {
  for (const category of energieheld.categories) {
    assert.equal(
      (
        await db.query("select is_energyheld_category_id($1) as valid", [
          category.id,
        ])
      ).rows[0].valid,
      true,
    );
  }
  const definition = (
    await db.query(
      "select pg_get_functiondef('is_energyheld_category_id(text)'::regprocedure) as source",
    )
  ).rows[0].source;
  const ids = [...definition.matchAll(/'([a-z]+)'(?:::text)?/g)]
    .map((match) => match[1])
    .filter(Boolean);
  assert.deepEqual(ids.sort(), energieheld.categories.map((c) => c.id).sort());
});

test("owner writes business areas but has no direct category insert/update/delete privileges", async () => {
  await actor(owner);
  await db.query("update company_profiles set business_areas=$1 where id=$2", [
    "WDVS und Fassade",
    profile,
  ]);
  assert.equal(
    (
      await db.query(
        "select business_areas from company_profiles where id=$1",
        [profile],
      )
    ).rows[0].business_areas,
    "WDVS und Fassade",
  );
  await blocked(
    "insert into company_profile_categories(profile_id,category_id) values ($1,'dach')",
    [profile],
    /permission denied/,
  );
  await blocked(
    "update company_profile_categories set category_id='dach' where profile_id=$1",
    [profile],
    /permission denied/,
  );
  await blocked(
    "delete from company_profile_categories where profile_id=$1",
    [profile],
    /permission denied/,
  );
});

test("anonymous and non-admin RPC calls are blocked", async () => {
  await actor("", "anon");
  await blocked(rpcSql, [profile, "approved", ["dach"]], /permission denied/);
  await actor(owner);
  await blocked(rpcSql, [profile, "approved", ["dach"]], /not authorized/);
});

test("approval without a category and arbitrary category or decision are rejected", async () => {
  await actor(admin);
  for (const ids of [[], null])
    await blocked(rpcSql, [profile, "approved", ids], /at least one category/);
  for (const ids of [["invalid"], [null], ["dach", "evil"]])
    await blocked(rpcSql, [profile, "approved", ids], /invalid category/);
  await blocked(rpcSql, [profile, "draft", ["dach"]], /invalid decision/);
});

test("approval atomically stores multiple categories and server approval timestamp", async () => {
  await actor(admin);
  await review(profile, "approved", ["daemmung", "fassade", "daemmung"]);
  assert.deepEqual(
    (
      await db.query(
        "select category_id from company_profile_categories where profile_id=$1 order by category_id",
        [profile],
      )
    ).rows.map((r) => r.category_id),
    ["daemmung", "fassade"],
  );
  const row = (
    await db.query(
      "select status,approved_at from company_profiles where id=$1",
      [profile],
    )
  ).rows[0];
  assert.equal(row.status, "approved");
  assert.ok(row.approved_at);
  await db.exec("set constraints all immediate");
});

test("approved categories public, pending categories owner/admin only; owners cannot read foreign pending assignments", async () => {
  await actor(admin);
  await review();
  await review(foreign, "approved", ["solar"]);
  await actor(other);
  await db.query("update company_profiles set status='draft' where id=$1", [
    foreign,
  ]);
  await actor("", "anon");
  assert.deepEqual(
    (await db.query("select category_id from company_profile_categories")).rows,
    [{ category_id: "daemmung" }],
  );
  await actor(owner);
  assert.equal(
    (
      await db.query(
        "select * from company_profile_categories where profile_id=$1",
        [foreign],
      )
    ).rows.length,
    0,
  );
  await actor(other);
  assert.equal(
    (
      await db.query(
        "select * from company_profile_categories where profile_id=$1",
        [foreign],
      )
    ).rows.length,
    1,
  );
  await actor(admin);
  assert.equal(
    (await db.query("select * from company_profile_categories")).rows.length,
    2,
  );
});

test("editing approved profile preserves assignments, reapproval replaces them", async () => {
  await actor(admin);
  await review();
  await actor(owner);
  await db.query(
    "update company_profiles set status='draft',business_areas='Fassade' where id=$1",
    [profile],
  );
  assert.deepEqual(
    (
      await db.query(
        "select category_id from company_profile_categories where profile_id=$1",
        [profile],
      )
    ).rows,
    [{ category_id: "daemmung" }],
  );
  await db.query("update company_profiles set status='pending' where id=$1", [
    profile,
  ]);
  await actor(admin);
  await review(profile, "approved", ["fassade"]);
  assert.deepEqual(
    (
      await db.query(
        "select category_id from company_profile_categories where profile_id=$1",
        [profile],
      )
    ).rows,
    [{ category_id: "fassade" }],
  );
});

test("rejection requires no categories and clears approved_at", async () => {
  await actor(admin);
  await review(profile, "rejected", []);
  assert.deepEqual(
    (
      await db.query(
        "select status,approved_at from company_profiles where id=$1",
        [profile],
      )
    ).rows,
    [{ status: "rejected", approved_at: null }],
  );
});

test("review requires pending, including when a previously reviewed ID is replayed", async () => {
  await actor(admin);
  await review();
  await blocked(rpcSql, [profile, "rejected", []], /profile not pending/);
  await actor(other);
  await db.query("update company_profiles set status='draft' where id=$1", [
    foreign,
  ]);
  await actor(admin);
  await blocked(
    rpcSql,
    [foreign, "approved", ["solar"]],
    /profile not pending/,
  );
});

test("legacy RPC rejects category-free approval but still supports rejection", async () => {
  await actor(admin);
  await blocked(
    "select review_company_profile($1,'approved')",
    [profile],
    /at least one category/,
  );
  assert.equal(
    (
      await db.query("select review_company_profile($1,'rejected') as status", [
        profile,
      ])
    ).rows[0].status,
    "rejected",
  );
});

test("RPC failure during final status update rolls back assignment replacement", async () => {
  await db.exec(
    "create function fail_test_approval() returns trigger language plpgsql as $$ begin if NEW.status='approved' then raise exception 'injected approval failure'; end if; return NEW; end $$; create trigger fail_test_approval before update on company_profiles for each row execute function fail_test_approval();",
  );
  await db.query(
    "insert into company_profile_categories(profile_id,category_id) values ($1,'dach')",
    [profile],
  );
  await actor(admin);
  await blocked(
    rpcSql,
    [profile, "approved", ["solar"]],
    /injected approval failure/,
  );
  assert.deepEqual(
    (
      await db.query(
        "select category_id from company_profile_categories where profile_id=$1",
        [profile],
      )
    ).rows,
    [{ category_id: "dach" }],
  );
  assert.equal(
    (
      await db.query("select status from company_profiles where id=$1", [
        profile,
      ])
    ).rows[0].status,
    "pending",
  );
});

test("deferred integrity check prevents direct approval without categories", async () => {
  await db.exec("set constraints all immediate");
  await blocked(
    "update company_profiles set status='approved' where id=$1",
    [profile],
    /requires at least one category/,
  );
});

test("migration refuses legacy approvals before modifying schema or approval state", async () => {
  const legacy = new PGlite();
  try {
    await legacy.exec(
      await readFile(
        new URL("./fixtures/company-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    await legacy.query("insert into companies values ($1,$1,'Legacy')", [
      owner,
    ]);
    await legacy.query(
      "insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Legacy','approved')",
      [profile, owner],
    );
    await assert.rejects(
      legacy.exec(await readFile(migration, "utf8")),
      /Existing approved profiles/,
    );
    assert.equal(
      (
        await legacy.query("select status from company_profiles where id=$1", [
          profile,
        ])
      ).rows[0].status,
      "approved",
    );
    assert.equal(
      (
        await legacy.query(
          "select to_regclass('public.company_profile_categories') as relation",
        )
      ).rows[0].relation,
      null,
    );
    assert.equal(
      (
        await legacy.query(
          "select column_name from information_schema.columns where table_name='company_profiles' and column_name='business_areas'",
        )
      ).rows.length,
      0,
    );
  } finally {
    await legacy.close();
  }
});
