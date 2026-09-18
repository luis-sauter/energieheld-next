import test, { before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMediaTestDatabase } from "./helpers/media-database.mjs";
const owner = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
const campaign = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  foreign = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db;
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
      "insert into company_profiles(id,company_id,display_name,status) values($1,$1,'Firma','pending')",
      [id],
    );
  }
  for (const file of [
    "20260917135441_company_leads.sql",
    "20260917142913_company_quality_reviews.sql",
    "20260917150024_company_quality_requests.sql",
    "20260917203041_company_ad_campaigns.sql",
    "20260918111325_dashboard_analytics_foundation.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  await db.query(
    "insert into company_ad_campaigns(id,profile_id,internal_name) values($1,$2,'Eigene Kampagne'),($3,$4,'Fremde Kampagne')",
    [campaign, owner, foreign, other],
  );
});
after(async () => db?.close());
beforeEach(async () => db.exec("begin"));
afterEach(async () => db.exec("rollback"));
async function actor(id = owner, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  await db.exec(`set local role ${role}`);
}
async function denied(run) {
  await db.exec("savepoint denied");
  await assert.rejects(run);
  await db.exec("rollback to savepoint denied;release savepoint denied");
}
async function report(days = 30, asAdmin = false) {
  return (
    await db.query(
      `select ${asAdmin ? "get_admin_dashboard_metrics" : "get_company_dashboard_metrics"}($1) as data`,
      [days],
    )
  ).rows[0].data;
}
async function seedMetrics() {
  for (const [id, mult] of [
    [owner, 1],
    [other, 100],
  ])
    for (const days of [0, 6, 7, 29, 30, -1])
      await db.query(
        "insert into company_daily_metrics(profile_id,metric_date,profile_views,contact_clicks,website_clicks) values($1,(now() at time zone 'Europe/Berlin')::date-$2::integer,$3,$4,$5)",
        [id, days, mult, mult * 2, mult * 3],
      );
  for (const [id, mult] of [
    [campaign, 1],
    [foreign, 100],
  ])
    for (const days of [0, 6, 7, 29, 30, -1])
      await db.query(
        "insert into ad_campaign_daily_metrics(campaign_id,metric_date,impressions,clicks) values($1,(now() at time zone 'Europe/Berlin')::date-$2::integer,$3,$4)",
        [id, days, mult * 10, mult],
      );
}
test("analytics RLS isolates owner profile and ad metrics; admin reads all; anon has no access", async () => {
  await seedMetrics();
  await actor(owner);
  assert.equal(
    (await db.query("select * from company_daily_metrics")).rows.length,
    6,
  );
  assert.equal(
    (await db.query("select * from ad_campaign_daily_metrics")).rows.length,
    6,
  );
  assert.ok(
    (await db.query("select * from company_daily_metrics")).rows.every(
      (r) => r.profile_id === owner,
    ),
  );
  assert.ok(
    (await db.query("select * from ad_campaign_daily_metrics")).rows.every(
      (r) => r.campaign_id === campaign,
    ),
  );
  await actor(admin);
  assert.equal(
    (await db.query("select * from company_daily_metrics")).rows.length,
    12,
  );
  assert.equal(
    (await db.query("select * from ad_campaign_daily_metrics")).rows.length,
    12,
  );
  await actor("", "anon");
  for (const table of ["company_daily_metrics", "ad_campaign_daily_metrics"])
    await denied(() => db.query(`select * from ${table}`));
  await denied(() => report());
  await denied(() => report(30, true));
  await actor(owner);
  await denied(() => report(30, true));
  await actor(admin);
  await denied(() => report()); // No owned profile: cannot borrow another firm's report.
});
test("metrics have no client writes, including admins; counters nonnegative and keys unique", async () => {
  await seedMetrics();
  for (const id of [owner, admin]) {
    await actor(id);
    for (const table of [
      "company_daily_metrics",
      "ad_campaign_daily_metrics",
    ]) {
      await denied(() => db.query(`delete from ${table}`));
      await denied(() =>
        db.query(`update ${table} set metric_date=current_date`),
      );
      await denied(() => db.query(`insert into ${table} default values`));
    }
  }
  await actor(admin, "postgres");
  for (const [table, key, id, fields] of [
    [
      "company_daily_metrics",
      "profile_id",
      owner,
      ["profile_views", "contact_clicks", "website_clicks"],
    ],
    [
      "ad_campaign_daily_metrics",
      "campaign_id",
      campaign,
      ["impressions", "clicks"],
    ],
  ]) {
    for (const field of fields)
      await denied(() => db.query(`update ${table} set ${field}=-1`));
    await denied(() =>
      db.query(
        `insert into ${table}(${key},metric_date) select ${key},metric_date from ${table} limit 1`,
      ),
    );
    await db.query(
      `insert into ${table}(${key},metric_date) values($1,'2000-01-01')`,
      [id],
    );
    const row = (
      await db.query(`select * from ${table} where metric_date='2000-01-01'`)
    ).rows[0];
    for (const f of fields) assert.equal(Number(row[f]), 0);
  }
});
test("company 7/30/all sums include today and exact calendar boundaries but exclude future dates", async () => {
  await seedMetrics();
  await actor(owner);
  for (const [days, expected] of [
    [7, 2],
    [30, 4],
    [null, 5],
  ]) {
    const data = await report(days);
    assert.equal(data.traffic.profile_views, expected);
    assert.equal(data.traffic.contact_clicks, expected * 2);
    assert.equal(data.traffic.website_clicks, expected * 3);
    assert.equal(data.campaigns.length, 1);
    assert.equal(data.campaigns[0].id, campaign);
    assert.equal(data.campaigns[0].impressions, expected * 10);
    assert.equal(data.campaigns[0].clicks, expected);
  }
  for (const invalid of [0, 1, 31, -1]) await denied(() => report(invalid));
});
test("empty analytics returns zero and own campaigns remain in the table without metrics", async () => {
  await actor(owner);
  const data = await report();
  assert.deepEqual(data.traffic, {
    profile_views: 0,
    contact_clicks: 0,
    website_clicks: 0,
    has_data: false,
  });
  assert.deepEqual(data.leads, { new: 0, total: 0, received: 0 });
  assert.equal(data.campaigns[0].impressions, 0);
  assert.equal(data.campaigns[0].clicks, 0);
  await actor(admin);
  const all = await report(30, true);
  assert.equal(all.traffic.profile_views, 0);
  assert.deepEqual(all.advertising, {
    impressions: 0,
    clicks: 0,
    has_data: false,
  });
});
test("lead totals come from real lead rows; period uses Berlin midnight and open counts include read", async () => {
  await db.query(
    "insert into company_leads(profile_id,name,email,message,status,created_at) values($1,'Kunde','kunde@example.org','Anfrage','new',now()),($1,'Kunde','kunde@example.org','Anfrage','read',(((now() at time zone 'Europe/Berlin')::date-6)::timestamp at time zone 'Europe/Berlin')),($1,'Kunde','kunde@example.org','Anfrage','done',(((now() at time zone 'Europe/Berlin')::date-6)::timestamp at time zone 'Europe/Berlin')-interval '1 second'),($2,'Fremd','fremd@example.org','Anfrage','new',now())",
    [owner, other],
  );
  await actor(owner);
  assert.deepEqual((await report(7)).leads, { new: 1, total: 3, received: 2 });
  assert.equal((await report(30)).leads.received, 3);
  await actor(admin);
  const all = await report(7, true);
  assert.equal(all.counts.leads_new, 2);
  assert.equal(all.counts.leads_open, 3);
  // Read aggregation does not expand the admin's access to private lead content.
  assert.equal((await db.query("select * from company_leads")).rows.length, 0);
});
test("admin sums cover all profiles/campaigns; period filtering matches company reports", async () => {
  await seedMetrics();
  await actor(admin);
  for (const [days, n] of [
    [7, 2],
    [30, 4],
    [null, 5],
  ]) {
    const data = await report(days, true);
    assert.equal(data.traffic.profile_views, n * 101);
    assert.equal(data.advertising.impressions, n * 1010);
    assert.equal(data.advertising.clicks, n * 101);
  }
});
test("dashboard counts derive publication, quality and campaign states without changing them", async () => {
  await actor(admin);
  await db.query(
    "select review_company_profile_with_categories($1,'approved',array['solar'])",
    [owner],
  );
  await actor(owner);
  await db.query("select request_company_verification($1)", [owner]);
  await actor(admin, "postgres");
  for (const [status, offset] of [
    ["draft", 0],
    ["pending", 0],
    ["approved", 0],
    ["approved", 1],
    ["approved", -1],
    ["paused", 0],
    ["rejected", 0],
  ]) {
    const id = crypto.randomUUID();
    await db.query(
      "insert into company_ad_campaigns(id,profile_id,internal_name,headline,target_url,image_path,status,approved_start_date,approved_end_date) values($1,$2,'Anzeige','Headline','https://example.org',$3,$4,(now() at time zone 'Europe/Berlin')::date+$5::integer,(now() at time zone 'Europe/Berlin')::date+$5::integer)",
      [
        id,
        owner,
        `campaigns/${id}/creative/${crypto.randomUUID()}.png`,
        status,
        offset,
      ],
    );
  }
  const before = (
    await db.query(
      "select to_jsonb(a) as row from company_ad_campaigns a order by id",
    )
  ).rows;
  await actor(owner);
  const own = await report();
  assert.deepEqual(own.ads, {
    draft: 2,
    pending: 1,
    active: 1,
    scheduled: 1,
    expired: 1,
    paused: 1,
    rejected: 1,
  });
  await actor(admin);
  const all = await report(7, true);
  assert.equal(all.counts.published, 1);
  assert.equal(all.counts.profiles_pending, 1);
  assert.equal(all.counts.quality_pending, 1);
  assert.equal(all.counts.ads_active, 1);
  assert.equal(all.counts.ads_scheduled, 1);
  assert.equal(all.counts.ads_pending, 1);
  await actor(admin, "postgres");
  assert.deepEqual(
    (
      await db.query(
        "select to_jsonb(a) as row from company_ad_campaigns a order by id",
      )
    ).rows,
    before,
  );
  assert.equal(
    (await db.query("select count(*)::int as n from company_daily_metrics"))
      .rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*)::int as n from ad_campaign_daily_metrics"))
      .rows[0].n,
    0,
  );
});
test("read functions are stable and cannot be public increments; Berlin boundaries honor DST", async () => {
  const defs = (
    await db.query(
      "select proname,provolatile,proconfig from pg_proc where proname in ('get_company_dashboard_metrics','get_admin_dashboard_metrics')",
    )
  ).rows;
  assert.equal(defs.length, 2);
  assert.ok(
    defs.every(
      (x) => x.provolatile === "s" && x.proconfig.includes('search_path=""'),
    ),
  );
  const period = (await db.query("select * from dashboard_period(7)")).rows[0];
  assert.equal(
    (new Date(period.today) - new Date(period.first_day)) / 86400000,
    6,
  );
  const dst = (
    await db.query(
      "select extract(epoch from (('2026-03-30'::timestamp at time zone 'Europe/Berlin')-('2026-03-29'::timestamp at time zone 'Europe/Berlin')))/3600 as spring, extract(epoch from (('2026-10-26'::timestamp at time zone 'Europe/Berlin')-('2026-10-25'::timestamp at time zone 'Europe/Berlin')))/3600 as autumn",
    )
  ).rows[0];
  assert.equal(Number(dst.spring), 23);
  assert.equal(Number(dst.autumn), 25);
});
test("metric rows cascade with their parent and repeated reads preserve all stored data", async () => {
  await seedMetrics();
  const before = (
    await db.query(
      "select to_jsonb(m) as row from company_daily_metrics m order by profile_id,metric_date",
    )
  ).rows;
  await actor(owner);
  await report(7);
  await report(30);
  await report(null);
  await actor(admin);
  await report(30, true);
  await actor(admin, "postgres");
  assert.deepEqual(
    (
      await db.query(
        "select to_jsonb(m) as row from company_daily_metrics m order by profile_id,metric_date",
      )
    ).rows,
    before,
  );
  await db.query("delete from company_profiles where id=$1", [owner]);
  assert.equal(
    (
      await db.query(
        "select * from company_daily_metrics where profile_id=$1",
        [owner],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select * from ad_campaign_daily_metrics where campaign_id=$1",
        [campaign],
      )
    ).rows.length,
    0,
  );
});
