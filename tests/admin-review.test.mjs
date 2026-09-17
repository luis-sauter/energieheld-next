import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const {
  checkAdmin,
  loadReviewOverview,
  loadReviewProfile,
  approvePendingProfile,
  rejectPendingProfile,
  validateCategoryIds,
} = await import("../src/lib/admin-review.ts");
import { canReviewProfile } from "../src/lib/admin-review-state.ts";

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function client({
  authenticated = true,
  admin = true,
  adminError = null,
  rpcError = null,
  rpcThrows = false,
  queueError = null,
  reviewed = false,
} = {}) {
  const calls = [];
  const profiles = [
    {
      id: profileId,
      status: "pending",
      submitted_at: "2026-09-01",
      display_name: "A",
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "approved",
      submitted_at: "2026-08-01",
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "pending",
      submitted_at: "2026-08-01",
      display_name: "C",
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      status: "rejected",
      submitted_at: "2026-08-01",
    },
  ];
  return {
    calls,
    auth: {
      getUser: async () => ({
        data: {
          user: authenticated
            ? {
                id: "verified-user",
                user_metadata: { user_id: "forged-admin", role: "admin" },
              }
            : null,
        },
        error: null,
      }),
    },
    from(table) {
      const call = { table, filters: [], orders: [] };
      calls.push(call);
      const result = () => {
        if (table === "portal_admins")
          return {
            data: admin ? { user_id: "verified-user" } : null,
            error: adminError,
          };
        let data = profiles.filter((p) =>
          call.filters.every(([key, value]) => p[key] === value),
        );
        for (const [key, options] of [...call.orders].reverse()) {
          data = data.toSorted(
            (a, b) =>
              String(a[key]).localeCompare(String(b[key])) *
              (options.ascending ? 1 : -1),
          );
        }
        return {
          data: call.single ? (data[0] ?? null) : data,
          count: data.length,
          error: queueError,
        };
      };
      return {
        select(columns, options) {
          call.columns = columns;
          call.options = options;
          return this;
        },
        eq(key, value) {
          call.filters.push([key, value]);
          return this;
        },
        order(key, options) {
          call.orders.push([key, options]);
          return this;
        },
        async maybeSingle() {
          call.single = true;
          return result();
        },
        then(resolve, reject) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
    },
    async rpc(name, params) {
      calls.push({ rpc: name, params });
      if (rpcThrows) throw new Error("private network detail");
      return {
        data: rpcError || reviewed ? null : params.p_decision,
        error:
          rpcError ||
          (reviewed ? { message: "profile not pending or not found" } : null),
      };
    },
  };
}

test("unauthenticated admin access fails without table reads", async () => {
  const db = client({ authenticated: false });
  assert.equal(await checkAdmin(db), "unauthenticated");
  assert.deepEqual(db.calls, []);
});

test("signed-in non-admin and failed role lookups fail closed", async () => {
  assert.equal(await checkAdmin(client({ admin: false })), "forbidden");
  assert.equal(
    await checkAdmin(client({ adminError: { message: "denied" } })),
    "forbidden",
  );
});

test("admin membership uses the verified user, never editable metadata or supplied IDs", async () => {
  const db = client();
  assert.equal(await checkAdmin(db, { user_id: "forged-admin" }), "admin");
  assert.deepEqual(db.calls[0].filters, [["user_id", "verified-user"]]);
});

test("non-admin cannot load overview or details or call a review RPC", async () => {
  for (const action of [
    loadReviewOverview,
    loadReviewProfile,
    approvePendingProfile,
    rejectPendingProfile,
  ]) {
    const db = client({ admin: false });
    const result = await action(db, profileId);
    assert.equal(result.access, "forbidden");
    assert.equal(result.profile, undefined);
    assert.equal(result.profiles, undefined);
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
});

test("admin overview contains pending only, oldest first, with separate status counts", async () => {
  const result = await loadReviewOverview(client());
  assert.equal(result.access, "admin");
  assert.deepEqual(result.counts, { pending: 2, approved: 1, rejected: 1 });
  assert.deepEqual(
    result.profiles.map((p) => p.display_name),
    ["C", "A"],
  );
  assert.ok(result.profiles.every((p) => p.status === "pending"));
});

test("admin can load a profile by profile ID after role check", async () => {
  const db = client();
  const result = await loadReviewProfile(db, profileId);
  assert.equal(result.profile.id, profileId);
  assert.deepEqual(db.calls[1].filters, [["id", profileId]]);
});

test("invalid profile IDs fail without querying company profiles or RPC", async () => {
  for (const action of [
    loadReviewProfile,
    approvePendingProfile,
    rejectPendingProfile,
  ]) {
    const db = client();
    await action(db, "not-a-uuid");
    assert.equal(db.calls.length, 1);
  }
});

test("approve sends only the fixed approved decision, ignoring extra client data", async () => {
  const db = client();
  const result = await approvePendingProfile(db, profileId, ["daemmung"], {
    decision: "rejected",
    user_id: "forged-admin",
  });
  assert.equal(result.success, "Das Firmenprofil wurde freigegeben.");
  assert.deepEqual(db.calls.at(-1), {
    rpc: "review_company_profile_with_categories",
    params: {
      p_profile_id: profileId,
      p_decision: "approved",
      p_category_ids: ["daemmung"],
    },
  });
});

test("reject sends only the fixed rejected decision", async () => {
  const db = client();
  assert.ok(
    (await rejectPendingProfile(db, profileId, { decision: "approved" }))
      .success,
  );
  assert.equal(db.calls.at(-1).params.p_decision, "rejected");
});

test("UI enables review only for pending profiles", () => {
  assert.equal(canReviewProfile("pending"), true);
  for (const status of ["draft", "approved", "rejected", "unexpected"])
    assert.equal(canReviewProfile(status), false);
});

test("RPC prevents reviewing a previously reviewed profile even with a stale UI", async () => {
  const result = await approvePendingProfile(
    client({ reviewed: true }),
    profileId,
    ["daemmung"],
  );
  assert.ok(result.error);
  assert.equal(result.success, undefined);
});

test("approval requires categories and rejects unknown or malformed IDs before RPC", async () => {
  for (const ids of [
    [],
    undefined,
    "dach",
    ["invented"],
    [null],
    ["dach", "unknown"],
  ]) {
    const db = client();
    const result = await approvePendingProfile(db, profileId, ids);
    assert.ok(result.error);
    assert.equal(
      db.calls.some((call) => call.rpc),
      false,
    );
  }
  assert.equal(
    validateCategoryIds([]).error,
    "Bitte wählen Sie mindestens ein Gewerk aus.",
  );
});

test("approval accepts multiple canonical IDs, deduplicates and passes exact IDs", async () => {
  const db = client();
  assert.ok(
    (
      await approvePendingProfile(db, profileId, [
        "daemmung",
        "fassade",
        "daemmung",
      ])
    ).success,
  );
  assert.deepEqual(db.calls.at(-1).params.p_category_ids, [
    "daemmung",
    "fassade",
  ]);
});

test("admin detail loads business areas and existing category assignments", async () => {
  const db = client();
  await loadReviewProfile(db, profileId);
  assert.match(db.calls.at(-1).columns, /business_areas/);
  assert.match(
    db.calls.at(-1).columns,
    /company_profile_categories\(category_id\)/,
  );
});

test("RPC and queue errors never expose raw backend messages", async () => {
  for (const options of [
    { rpcError: { message: "private database detail" } },
    { rpcThrows: true },
  ]) {
    const result = await rejectPendingProfile(client(options), profileId);
    assert.ok(result.error);
    assert.equal(result.error.includes("private"), false);
    assert.equal(result.success, undefined);
  }
  const result = await loadReviewOverview(
    client({ queueError: { message: "private table error" } }),
  );
  assert.ok(result.error);
  assert.equal(result.profiles, undefined);
});

const { changeQualityReview } = await import("../src/lib/company-quality.ts");
test("quality mutation checks real admin membership and only sends fixed RPC arguments", async () => {
  const form = new FormData();
  form.set("profile_id", profileId);
  form.set("intent", "verify");
  form.set("public_note", " Hinweis ");
  form.set("verified_by", "forged");
  form.set("status", "approved");
  for (const options of [
    { authenticated: false },
    { admin: false },
    { adminError: { message: "denied" } },
  ]) {
    const db = client(options);
    const result = await changeQualityReview(db, form);
    assert.notEqual(result.access, "admin");
    assert.ok(!db.calls.some((c) => c.rpc));
  }
  const db = client();
  assert.ok((await changeQualityReview(db, form)).success);
  assert.deepEqual(
    db.calls.find((c) => c.rpc),
    {
      rpc: "verify_company_profile",
      params: { p_profile_id: profileId, p_public_note: "Hinweis" },
    },
  );
  form.set("intent", "remove");
  const removal = client();
  assert.ok((await changeQualityReview(removal, form)).success);
  assert.deepEqual(
    removal.calls.find((c) => c.rpc),
    { rpc: "remove_company_verification", params: { p_profile_id: profileId } },
  );
  for (const options of [
    { rpcError: { message: "private error" } },
    { rpcThrows: true },
  ]) {
    const result = await changeQualityReview(client(options), form);
    assert.ok(result.error);
    assert.equal(result.success, undefined);
    assert.doesNotMatch(result.error, /private/);
  }
  form.set("intent", "verify");
  form.set("public_note", "x".repeat(1001));
  const invalid = client();
  assert.ok((await changeQualityReview(invalid, form)).error);
  assert.ok(!invalid.calls.some((c) => c.rpc));
});
