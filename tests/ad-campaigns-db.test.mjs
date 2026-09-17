import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
let db, today;
before(async () => {
  db = await createMediaTestDatabase(true);
  await db.exec("create table auth.users(id uuid primary key)");
  await db.query("insert into auth.users values($1),($2),($3)", [
    owner,
    other,
    admin,
  ]);
  await db.query("insert into portal_admins values($1)", [admin]);
  for (const id of [owner, other]) {
    await db.query("insert into companies values($1,$1,'Firma')", [id]);
    await db.query(
      "insert into company_profiles(id,company_id,display_name,status) values($1,$1,'Firma','draft')",
      [id],
    );
  }
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20260917203041_company_ad_campaigns.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  today = (
    await db.query(
      "select ((now() at time zone 'Europe/Berlin')::date)::text as day",
    )
  ).rows[0].day;
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function actor(id = owner, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function denied(run, pattern) {
  await db.exec("savepoint denied");
  await assert.rejects(run, pattern);
  await db.exec("rollback to savepoint denied;release savepoint denied");
}
async function create(id = owner) {
  await actor(id);
  return (await db.query("select create_ad_campaign() as id")).rows[0].id;
}
async function prepare(overrides = {}, id = owner, submit = true) {
  const campaign = await create(id),
    image = `campaigns/${campaign}/creative/${crypto.randomUUID()}.png`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('ad-media',$1)",
    [image],
  );
  const values = {
    internal_name: "Kampagne",
    placement: "top_banner",
    scope_type: "experts_directory",
    category_id: null,
    headline: "Handwerk",
    body_text: "Aus Ihrer Region",
    target_url: "https://example.org/angebot",
    image_path: image,
    requested_start_date: today,
    requested_end_date: today,
    ...overrides,
  };
  await db.query("select save_ad_campaign($1,$2,$3)", [
    campaign,
    values,
    submit,
  ]);
  return { id: campaign, image, values };
}
async function decide(c, action = "approve", start = today, end = today) {
  await actor(admin);
  return db.query("select review_ad_campaign($1,$2,$3,$4,'Hinweis')", [
    c.id,
    action,
    start,
    end,
  ]);
}
async function publicAds(scope = "experts_directory", category = null) {
  await actor("", "anon");
  return (
    await db.query("select * from get_active_ad_campaigns($1,$2)", [
      scope,
      category,
    ])
  ).rows;
}

test("ad RLS: owners see only own campaigns; direct writes and self approval are blocked", async () => {
  const a = await prepare({}, owner, false),
    b = await prepare({}, other, false);
  await actor(owner);
  assert.deepEqual(
    (await db.query("select id from company_ad_campaigns")).rows,
    [{ id: a.id }],
  );
  await denied(() =>
    db.query("update company_ad_campaigns set status='approved'"),
  );
  await denied(() =>
    db.query("insert into company_ad_campaigns(profile_id) values($1)", [
      other,
    ]),
  );
  await denied(() => db.query("delete from company_ad_campaigns"));
  await denied(() =>
    db.query("select save_ad_campaign($1,$2,false)", [b.id, a.values]),
  );
  await denied(() =>
    db.query("select review_ad_campaign($1,'approve',$2,$2,null)", [
      a.id,
      today,
    ]),
  );
  await actor(admin);
  assert.equal(
    (await db.query("select id from company_ad_campaigns")).rows.length,
    2,
  );
  await actor("", "anon");
  await denied(() => db.query("select * from company_ad_campaigns"));
  await denied(() => db.query("select create_ad_campaign()"));
  await denied(() =>
    db.query("select save_ad_campaign($1,$2,false)", [a.id, a.values]),
  );
});
test("ad mutations ignore forged privileged fields and only draft/rejected can be edited", async () => {
  const a = await prepare(
    {
      status: "approved",
      profile_id: other,
      admin_note: "forged",
      reviewed_by: owner,
      approved_start_date: today,
    },
    owner,
    false,
  );
  let row = (await db.query("select * from company_ad_campaigns")).rows[0];
  assert.equal(row.profile_id, owner);
  assert.equal(row.status, "draft");
  assert.equal(row.admin_note, null);
  assert.equal(row.reviewed_by, null);
  assert.equal(row.approved_start_date, null);
  await db.query("select save_ad_campaign($1,$2,true)", [a.id, a.values]);
  await denied(() =>
    db.query("select save_ad_campaign($1,$2,false)", [a.id, a.values]),
  );
  await decide(a, "reject");
  await actor(owner);
  await db.query("select save_ad_campaign($1,$2,true)", [
    a.id,
    { ...a.values, headline: "Verbessert" },
  ]);
  await decide(a);
  await actor(owner);
  await denied(() =>
    db.query("select save_ad_campaign($1,$2,false)", [a.id, a.values]),
  );
  await decide(a, "pause");
  await actor(owner);
  await denied(() =>
    db.query("select save_ad_campaign($1,$2,false)", [a.id, a.values]),
  );
});
test("ad storage is private, isolated, immutable and enforces bucket type/size configuration", async () => {
  const a = await prepare({}, owner, false);
  await actor(admin, "postgres");
  const bucket = (
    await db.query("select * from storage.buckets where id='ad-media'")
  ).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(Number(bucket.file_size_limit), 5242880);
  assert.deepEqual(bucket.allowed_mime_types, [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  await actor(other);
  assert.equal(
    (await db.query("select * from storage.objects where bucket_id='ad-media'"))
      .rows.length,
    0,
  );
  await denied(() =>
    db.query(
      "insert into storage.objects(bucket_id,name) values('ad-media',$1)",
      [`campaigns/${a.id}/creative/${crypto.randomUUID()}.png`],
    ),
  );
  await actor(owner);
  for (const extension of ["svg", "gif", "pdf", "html"])
    await denied(() =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('ad-media',$1)",
        [`campaigns/${a.id}/creative/${crypto.randomUUID()}.${extension}`],
      ),
    );
  assert.equal(
    (
      await db.query(
        "update storage.objects set name='forged' where name=$1 returning name",
        [a.image],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [a.image],
      )
    ).rows.length,
    0,
  );
  const orphan = `campaigns/${a.id}/creative/${crypto.randomUUID()}.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('ad-media',$1)",
    [orphan],
  );
  assert.equal(
    (
      await db.query(
        "delete from storage.objects where name=$1 returning name",
        [orphan],
      )
    ).rows.length,
    1,
  );
  await actor("", "anon");
  assert.equal(
    (await db.query("select * from storage.objects where bucket_id='ad-media'"))
      .rows.length,
    0,
  );
  await actor(owner);
  await db.query("select save_ad_campaign($1,$2,true)", [a.id, a.values]);
  await denied(() =>
    db.query(
      "insert into storage.objects(bucket_id,name) values('ad-media',$1)",
      [`campaigns/${a.id}/creative/${crypto.randomUUID()}.png`],
    ),
  );
  await decide(a);
  await actor("", "anon");
  assert.equal(
    (
      await db.query(
        "select name from storage.objects where bucket_id='ad-media'",
      )
    ).rows[0].name,
    a.image,
  );
  await decide(a, "pause");
  await actor("", "anon");
  assert.equal(
    (
      await db.query(
        "select name from storage.objects where bucket_id='ad-media'",
      )
    ).rows.length,
    0,
  );
});
test("ad save rejects invalid URL, placement, category, dates and foreign media in direct RPC", async () => {
  const a = await prepare({}, owner, false),
    b = await prepare({}, other, false);
  await actor(owner);
  for (const override of [
    { target_url: "javascript:alert(1)" },
    { placement: "invented" },
    { scope_type: "trade", category_id: "invented" },
    { scope_type: "all_trades", category_id: "solar" },
    { requested_end_date: "2000-01-01" },
    { image_path: b.image },
  ])
    await denied(() =>
      db.query("select save_ad_campaign($1,$2,false)", [
        a.id,
        { ...a.values, ...override },
      ]),
    );
  await denied(() =>
    db.query("select save_ad_campaign($1,$2,true)", [
      a.id,
      { ...a.values, image_path: null },
    ]),
  );
});
for (const status of [
  "draft",
  "pending",
  "rejected",
  "paused",
  "future",
  "expired",
  "active",
])
  test(`public ads: ${status}`, async () => {
    const a = await prepare({}, owner, status !== "draft");
    if (status === "rejected") await decide(a, "reject");
    if (["paused", "future", "expired", "active"].includes(status))
      await decide(
        a,
        "approve",
        status === "future"
          ? "2099-01-01"
          : status === "expired"
            ? "2000-01-01"
            : today,
        status === "future"
          ? "2099-12-31"
          : status === "expired"
            ? "2000-12-31"
            : today,
      );
    if (status === "paused") await decide(a, "pause");
    const ads = await publicAds();
    assert.equal(ads.length, status === "active" ? 1 : 0);
    if (ads.length) {
      assert.deepEqual(
        Object.keys(ads[0]).sort(),
        [
          "id",
          "placement",
          "headline",
          "body_text",
          "target_url",
          "image_path",
        ].sort(),
      );
      assert.equal(ads[0].id, a.id);
    }
  });
test("public scopes: experts, all trades and exact trade are separate; invalid scopes return nothing", async () => {
  const e = await prepare(),
    all = await prepare({ scope_type: "all_trades", placement: "sidebar_top" }),
    solar = await prepare({
      scope_type: "trade",
      category_id: "solar",
      placement: "sidebar_middle",
    });
  for (const a of [e, all, solar]) await decide(a);
  assert.deepEqual(
    (await publicAds()).map((x) => x.id),
    [e.id],
  );
  assert.deepEqual(
    new Set((await publicAds("trade", "solar")).map((x) => x.id)),
    new Set([all.id, solar.id]),
  );
  assert.deepEqual(
    (await publicAds("trade", "dach")).map((x) => x.id),
    [all.id],
  );
  assert.equal((await publicAds("trade", "invalid")).length, 0);
  assert.equal((await publicAds("profile", owner)).length, 0);
});
test("booking conflicts include inclusive boundary, same scope and wildcard both directions", async () => {
  for (const scopes of [
    [{ scope_type: "experts_directory" }, { scope_type: "experts_directory" }],
    [
      { scope_type: "all_trades" },
      { scope_type: "trade", category_id: "solar" },
    ],
    [
      { scope_type: "trade", category_id: "solar" },
      { scope_type: "all_trades" },
    ],
    [
      { scope_type: "trade", category_id: "solar" },
      { scope_type: "trade", category_id: "solar" },
    ],
  ]) {
    const a = await prepare(scopes[0]),
      b = await prepare(scopes[1]);
    await decide(a, "approve", "2030-01-01", "2030-01-31");
    await denied(
      () => decide(b, "approve", "2030-01-31", "2030-02-28"),
      /ad_booking_conflict/,
    );
    await decide(b, "approve", "2030-02-01", "2030-02-28");
    await decide(a, "pause");
    await decide(b, "pause");
  }
});
test("different trades, placements and experts scope can book simultaneously", async () => {
  const rows = [];
  for (const opts of [
    { scope_type: "trade", category_id: "solar" },
    { scope_type: "trade", category_id: "dach" },
    { scope_type: "experts_directory" },
    { scope_type: "all_trades", placement: "sidebar_top" },
  ]) {
    const a = await prepare(opts);
    await decide(a);
    rows.push(a);
  }
  await actor(admin);
  assert.equal(
    (
      await db.query(
        "select id from company_ad_campaigns where status='approved'",
      )
    ).rows.length,
    4,
  );
});
test("pause frees booking; resume rechecks conflict and is admin-only", async () => {
  const a = await prepare(),
    b = await prepare();
  await decide(a);
  await decide(a, "pause");
  await decide(b);
  await denied(() => decide(a, "resume"), /ad_booking_conflict/);
  await actor(owner);
  await denied(() =>
    db.query("select review_ad_campaign($1,'resume',null,null,null)", [a.id]),
  );
  await decide(b, "pause");
  await decide(a, "resume");
  assert.equal((await publicAds())[0].id, a.id);
});
test("booking RPC rejects stale transaction isolation and serializes all scopes before querying conflicts", async () => {
  const a = await prepare();
  await actor(admin, "postgres");
  const definition = (
    await db.query(
      "select pg_get_functiondef('public.review_ad_campaign(uuid,text,date,date,text)'::regprocedure) as body",
    )
  ).rows[0].body;
  assert.ok(
    definition.indexOf("pg_advisory_xact_lock") <
      definition.indexOf("ad_booking_conflict"),
  );
  await db.exec("commit;begin isolation level repeatable read");
  await actor(admin);
  await denied(
    () =>
      db.query("select review_ad_campaign($1,'approve',$2,$2,null)", [
        a.id,
        today,
      ]),
    /read committed required/,
  );
  // Remove this committed fixture before other tests.
  await db.exec("rollback;begin;reset role");
  await db.query("delete from company_ad_campaigns where id=$1", [a.id]);
  await db.exec("commit;begin");
});
test("ad approval leaves profiles, categories and business data untouched", async () => {
  const before = (await db.query("select * from company_profiles order by id"))
    .rows;
  const cats = (await db.query("select * from company_profile_categories"))
    .rows;
  const a = await prepare();
  await decide(a);
  await decide(a, "pause");
  await decide(a, "resume");
  await actor(admin, "postgres");
  assert.deepEqual(
    (await db.query("select * from company_profiles order by id")).rows,
    before,
  );
  assert.deepEqual(
    (await db.query("select * from company_profile_categories")).rows,
    cats,
  );
});
