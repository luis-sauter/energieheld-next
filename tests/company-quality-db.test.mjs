import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db;
before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create table auth.users(id uuid primary key)");
  await db.query("insert into auth.users values ($1),($2),($3)", [
    owner,
    other,
    admin,
  ]);
  await db.query("insert into portal_admins values ($1)", [admin]);
  await db.query("insert into companies values ($1,$1,'Firma')", [owner]);
  await db.query(
    "insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Firma','pending')",
    [profile, owner],
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260917142913_company_quality_reviews.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260917150024_company_quality_requests.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
test("quality requests: owner isolation, no public reads and no direct writes, even for admins", async () => {
  await actor(other);
  await denied(() =>
    db.query("select request_company_verification($1)", [profile]),
  );
  await actor(owner);
  await db.query("select request_company_verification($1)", [profile]);
  assert.equal(
    (await db.query("select * from company_quality_requests")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select status from company_quality_reviews")).rows.length,
    0,
  );
  for (const id of [owner, other, admin]) {
    await actor(id);
    assert.equal(
      (await db.query("select * from company_quality_requests")).rows.length,
      id === other ? 0 : 1,
    );
    await denied(() =>
      db.query(
        "insert into company_quality_requests(profile_id,status) values($1,'approved')",
        [profile],
      ),
    );
    await denied(() =>
      db.query("update company_quality_requests set status='approved'"),
    );
    await denied(() => db.query("delete from company_quality_requests"));
  }
  await actor("", "anon");
  await denied(() => db.query("select * from company_quality_requests"));
  await denied(() =>
    db.query("select request_company_verification($1)", [profile]),
  );
});
test("quality requests: only admin decides; rejection can be requested again; pending requests are idempotent", async () => {
  await actor(owner);
  await db.query("select request_company_verification($1)", [profile]);
  const first = (await db.query("select * from company_quality_requests"))
    .rows[0];
  await db.query("select request_company_verification($1)", [profile]);
  assert.deepEqual(
    (await db.query("select * from company_quality_requests")).rows[0],
    first,
  );
  for (const [id, role] of [
    [owner, "authenticated"],
    [other, "authenticated"],
    ["", "anon"],
  ]) {
    await actor(id, role);
    await denied(() =>
      db.query("select reject_company_verification_request($1)", [profile]),
    );
    await denied(() =>
      db.query("select verify_company_profile($1,null)", [profile]),
    );
  }
  await actor(admin);
  await db.query("select reject_company_verification_request($1)", [profile]);
  const rejected = (await db.query("select * from company_quality_requests"))
    .rows[0];
  assert.equal(rejected.status, "rejected");
  assert.ok(rejected.decided_at);
  await denied(() =>
    db.query("select verify_company_profile($1,null)", [profile]),
  );
  await actor(owner);
  await db.query("select request_company_verification($1)", [profile]);
  const next = (await db.query("select * from company_quality_requests"))
    .rows[0];
  assert.equal(next.status, "pending");
  assert.equal(next.decided_at, null);
  assert.ok(new Date(next.requested_at) >= new Date(first.requested_at));
  assert.equal(
    (await db.query("select status from company_quality_reviews")).rows.length,
    0,
  );
});
test("quality requests: new seals require pending; approval creates a real review atomically", async () => {
  await actor(admin);
  await denied(() =>
    db.query("select verify_company_profile($1,null)", [profile]),
  );
  await verify();
  const request = (await db.query("select * from company_quality_requests"))
    .rows[0];
  assert.equal(request.status, "approved");
  assert.ok(request.decided_at);
  assert.equal(
    (await db.query("select status from company_quality_reviews")).rows[0]
      .status,
    "verified",
  );
  await denied(() =>
    db.query("select reject_company_verification_request($1)", [profile]),
  );
  await actor(owner);
  await denied(() =>
    db.query("select request_company_verification($1)", [profile]),
  );
  await actor(admin);
  await db.query("select remove_company_verification($1)", [profile]);
  await denied(() =>
    db.query("select verify_company_profile($1,null)", [profile]),
  );
  await actor(owner);
  await db.query("select request_company_verification($1)", [profile]);
  assert.equal(
    (await db.query("select status from company_quality_requests")).rows[0]
      .status,
    "pending",
  );
});
test("quality requests: legacy verification remains editable and removable without a request", async () => {
  await db.query(
    "insert into company_quality_reviews(profile_id,status,verified_at,verified_by) values($1,'verified',now(),$2)",
    [profile, admin],
  );
  await actor(admin);
  await db.query("select verify_company_profile($1,'Neue Notiz')", [profile]);
  assert.equal(
    (await db.query("select public_note from company_quality_reviews")).rows[0]
      .public_note,
    "Neue Notiz",
  );
  assert.equal(
    (await db.query("select * from company_quality_requests")).rows.length,
    0,
  );
  await db.query("select remove_company_verification($1)", [profile]);
  assert.equal(
    (await db.query("select status from company_quality_reviews")).rows.length,
    0,
  );
});
async function actor(id = "", role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function denied(run) {
  await db.exec("savepoint denied");
  await assert.rejects(run);
  await db.exec("rollback to savepoint denied;release savepoint denied");
}
async function verify() {
  await actor(owner);
  await db.query("select request_company_verification($1)", [profile]);
  await actor(admin);
  await db.query("select verify_company_profile($1,$2)", [
    profile,
    " Persönlich bekannt ",
  ]);
}
test("only portal admins can verify/remove; owner and anon cannot write directly or via RPC", async () => {
  for (const [id, role] of [
    [owner, "authenticated"],
    [other, "authenticated"],
    ["", "anon"],
  ]) {
    await actor(id, role);
    await denied(() =>
      db.query("select verify_company_profile($1,null)", [profile]),
    );
    await denied(() =>
      db.query("select remove_company_verification($1)", [profile]),
    );
    await denied(() =>
      db.query(
        "insert into company_quality_reviews(profile_id,status,verified_at,verified_by) values($1,'verified',now(),$2)",
        [profile, id || owner],
      ),
    );
  }
  await verify();
  await actor(owner);
  await denied(() =>
    db.query("update company_quality_reviews set status='verified'"),
  );
  await denied(() => db.query("delete from company_quality_reviews"));
});
test("anon/other only read approved seals; owner and admin can read unpublished seal; verifier is private", async () => {
  await verify();
  await actor(owner);
  assert.equal(
    (await db.query("select status,public_note from company_quality_reviews"))
      .rows.length,
    1,
  );
  for (const [id, role] of [
    ["", "anon"],
    [other, "authenticated"],
  ]) {
    await actor(id, role);
    assert.equal(
      (await db.query("select status from company_quality_reviews")).rows
        .length,
      0,
    );
  }
  await actor(admin);
  await db.query(
    "select review_company_profile_with_categories($1,'approved',array['heizung'])",
    [profile],
  );
  for (const [id, role] of [
    ["", "anon"],
    [other, "authenticated"],
  ]) {
    await actor(id, role);
    assert.deepEqual(
      (await db.query("select status,public_note from company_quality_reviews"))
        .rows,
      [{ status: "verified", public_note: "Persönlich bekannt" }],
    );
    await denied(() =>
      db.query("select verified_by from company_quality_reviews"),
    );
  }
});
test("verification/update/removal preserve profile status, timestamps and official categories", async () => {
  await actor(admin);
  await db.query(
    "select review_company_profile_with_categories($1,'approved',array['heizung'])",
    [profile],
  );
  const before = (
    await db.query("select status,approved_at from company_profiles")
  ).rows;
  const cats = (
    await db.query("select category_id from company_profile_categories")
  ).rows;
  await verify();
  await db.query("select verify_company_profile($1,$2)", [
    profile,
    "Neue Notiz",
  ]);
  assert.equal(
    (await db.query("select public_note from company_quality_reviews")).rows[0]
      .public_note,
    "Neue Notiz",
  );
  await db.query("select remove_company_verification($1)", [profile]);
  assert.equal(
    (await db.query("select status from company_quality_reviews")).rows.length,
    0,
  );
  assert.deepEqual(
    (await db.query("select status,approved_at from company_profiles")).rows,
    before,
  );
  assert.deepEqual(
    (await db.query("select category_id from company_profile_categories")).rows,
    cats,
  );
});
test("RPC fixes status and actor, validates notes/profile, allows verifying pending without publication", async () => {
  await verify();
  await denied(() =>
    db.query("select verify_company_profile($1,$2)", [
      profile,
      "x".repeat(1001),
    ]),
  );
  await denied(() =>
    db.query("select verify_company_profile($1,null)", [other]),
  );
  await actor(admin, "postgres");
  const row = (await db.query("select * from company_quality_reviews")).rows[0];
  assert.equal(row.verified_by, admin);
  assert.equal(row.status, "verified");
  assert.ok(row.verified_at);
  assert.ok(row.created_at);
  assert.equal(
    (await db.query("select status from company_profiles")).rows[0].status,
    "pending",
  );
  await denied(() =>
    db.query("update company_quality_reviews set status='fake'"),
  );
  await db.query("delete from auth.users where id=$1", [admin]);
  const preserved = (await db.query("select * from company_quality_reviews"))
    .rows;
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].verified_by, null);
});
