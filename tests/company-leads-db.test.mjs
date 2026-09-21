import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  hidden = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db;
before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(
      new URL("./fixtures/company-schema.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260917135441_company_leads.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    "insert into companies values ($1,$1,'Firma'),($2,$2,'Andere')",
    [owner, other],
  );
  await db.query(
    "insert into company_profiles(id,company_id,display_name,status) values ($1,$2,'Firma','approved'),($3,$4,'Andere','draft')",
    [profile, owner, hidden, other],
  );
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function actor(id = "", role = "anon") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
const args = () => [
  profile,
  "  Max Mustermann  ",
  " MAX@EXAMPLE.ORG ",
  " 123 ",
  "  Bitte um Rückruf.  ",
  true,
  "",
];
const submit = (values = args()) =>
  db.query(
    "select public.create_company_lead($1,$2,$3,$4,$5,$6,$7) as ok",
    values,
  );
async function denied(run) {
  await db.exec("savepoint denied");
  await assert.rejects(run);
  await db.exec("rollback to savepoint denied; release savepoint denied");
}
test("anonymous RPC stores a trimmed approved-profile lead, returns only true, with stable ID for future events", async () => {
  await actor();
  assert.deepEqual((await submit()).rows, [{ ok: true }]);
  await actor(owner, "authenticated");
  const { rows } = await db.query("select * from company_leads");
  assert.equal(rows.length, 1);
  assert.match(rows[0].id, /^[0-9a-f-]{36}$/);
  assert.equal(rows[0].name, "Max Mustermann");
  assert.equal(rows[0].email, "max@example.org");
  assert.equal(rows[0].phone, "123");
  assert.equal(rows[0].message, "Bitte um Rückruf.");
  assert.equal(rows[0].status, "new");
  assert.ok(rows[0].created_at);
});
test("RPC rejects missing/draft/pending/rejected profiles and invalid data even without Server Action", async () => {
  await actor();
  for (const [index, value] of [
    [0, hidden],
    [0, null],
    [1, " \t\n "],
    [1, "x".repeat(121)],
    [2, "no-email"],
    [2, null],
    [2, "x".repeat(255)],
    [3, "x".repeat(51)],
    [4, ""],
    [4, "x".repeat(5001)],
    [5, false],
    [5, null],
    [6, "bot"],
  ]) {
    const values = args();
    values[index] = value;
    await denied(() => submit(values));
  }
  for (const status of ["pending", "rejected"]) {
    await actor(owner, "postgres");
    await db.query("update company_profiles set status=$1 where id=$2", [
      status,
      hidden,
    ]);
    await actor();
    const values = args();
    values[0] = hidden;
    await denied(() => submit(values));
  }
  await actor(owner, "authenticated");
  assert.equal((await db.query("select * from company_leads")).rows.length, 0);
});
test("identical normalized email/message is blocked for five minutes, then allowed; different message allowed", async () => {
  await actor();
  await submit();
  await denied(() => submit());
  const changed = args();
  changed[4] = "Andere Anfrage";
  await submit(changed);
  await actor(owner, "postgres");
  await db.exec(
    "update company_leads set created_at=now()-interval '6 minutes'",
  );
  await actor();
  await submit();
  await actor(owner, "authenticated");
  assert.equal((await db.query("select * from company_leads")).rows.length, 3);
});
test("anon has no direct table read/write and authenticated has no insert/delete", async () => {
  await actor();
  await submit();
  for (const role of ["anon", "authenticated"]) {
    await actor(owner, role);
    if (role === "anon")
      await denied(() => db.query("select * from company_leads"));
    await denied(() =>
      db.query(
        "insert into company_leads(profile_id,name,email,message) values ($1,'A','a@b.de','M')",
        [profile],
      ),
    );
    await denied(() => db.query("delete from company_leads"));
  }
});
test("owner sees only own leads and can update only status, with server-maintained timestamp", async () => {
  await actor();
  await submit();
  await actor(owner, "authenticated");
  const lead = (await db.query("select * from company_leads")).rows[0];
  for (const status of ["read", "done", "new"]) {
    await db.query("update company_leads set status=$1 where id=$2", [
      status,
      lead.id,
    ]);
    assert.equal(
      (await db.query("select status from company_leads")).rows[0].status,
      status,
    );
  }
  await denied(() => db.query("update company_leads set status='approved'"));
  for (const field of [
    "name",
    "email",
    "phone",
    "message",
    "profile_id",
    "created_at",
    "updated_at",
  ])
    await denied(() => db.query(`update company_leads set ${field}=${field}`));
  assert.ok(
    (await db.query("select updated_at from company_leads")).rows[0]
      .updated_at >= lead.updated_at,
  );
  await actor(other, "authenticated");
  assert.equal((await db.query("select * from company_leads")).rows.length, 0);
  assert.equal(
    (
      await db.query(
        "update company_leads set status='done' where id=$1 returning id",
        [lead.id],
      )
    ).rows.length,
    0,
  );
});
test("direct RPC cannot use a stale isolation snapshot and cascade deletion removes associated leads", async () => {
  await actor();
  await submit();
  await actor(owner, "postgres");
  await db.query("delete from company_profiles where id=$1", [profile]);
  assert.equal((await db.query("select * from company_leads")).rows.length, 0);
});

test("RPC rejects repeatable-read snapshots rather than allowing stale duplicate checks", async () => {
  await db.exec("rollback; begin isolation level repeatable read");
  await actor();
  await denied(() => submit());
});
