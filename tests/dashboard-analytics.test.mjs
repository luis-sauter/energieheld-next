import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsPeriod,
  analyticsDays,
  clickThroughRate,
  loadCompanyMetrics,
  loadAdminMetrics,
} from "../src/lib/dashboard-analytics.ts";
function client({
  user = { id: "verified-user" },
  error = null,
  data = {
    traffic: {
      profile_views: 0,
      contact_clicks: 0,
      website_clicks: 0,
      has_data: false,
    },
    campaigns: [],
  },
} = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data, error };
    },
    from() {
      throw Error("No daily metrics or per-campaign client query allowed");
    },
  };
}
test("period selection defaults to 30 days and uses null only for all time", () => {
  for (const value of [undefined, "", [], "365", "invalid"])
    assert.equal(analyticsPeriod(value), "30");
  assert.equal(analyticsPeriod("7"), "7");
  assert.equal(analyticsPeriod("gesamt"), "gesamt");
  assert.equal(analyticsDays("gesamt"), null);
  assert.equal(analyticsDays("7"), 7);
});
test("one read RPC per dashboard regardless of campaign count; no identifiers accepted from client", async () => {
  const db = client({
    data: {
      traffic: { profile_views: 0 },
      campaigns: Array.from({ length: 200 }, (_, i) => ({
        id: i,
        impressions: 0,
        clicks: 0,
      })),
    },
  });
  assert.equal((await loadCompanyMetrics(db, "7")).data.campaigns.length, 200);
  assert.deepEqual(db.calls, [
    { name: "get_company_dashboard_metrics", args: { p_days: 7 } },
  ]);
  const admin = client();
  await loadAdminMetrics(admin, "gesamt");
  assert.deepEqual(admin.calls, [
    { name: "get_admin_dashboard_metrics", args: { p_days: null } },
  ]);
});
test("no session means no metrics call; DB errors are errors, not invented zero values", async () => {
  const none = client({ user: null });
  assert.equal((await loadCompanyMetrics(none, "30")).unauthenticated, true);
  assert.deepEqual(none.calls, []);
  const result = await loadCompanyMetrics(
    client({ error: { message: "private" } }),
    "30",
  );
  assert.ok(result.error);
  assert.equal(result.data, undefined);
  assert.doesNotMatch(result.error, /private/);
  const empty = await loadCompanyMetrics(client(), "30");
  assert.equal(empty.data.traffic.profile_views, 0);
});
test("CTR has a defined zero denominator and no tracking writes are triggered by repeated reads", async () => {
  assert.equal(clickThroughRate(0, 0), 0);
  assert.equal(clickThroughRate(0, 10), 0);
  assert.equal(clickThroughRate(100, 5), 5);
  const db = client();
  for (const period of ["7", "30", "gesamt"])
    await loadCompanyMetrics(db, period);
  assert.ok(db.calls.every((x) => x.name === "get_company_dashboard_metrics"));
});
