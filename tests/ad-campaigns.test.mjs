import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { validateAdValues, adTargetUrl, adStatus, berlinToday } = await import(
  "../src/lib/ad-values.ts"
);
const { saveOwnAd, decideAd, signAdImages, loadAdCampaigns, prepareAdUpload } =
  await import("../src/lib/ad-campaigns.ts");
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const values = {
  campaign_id: id,
  intent: "save",
  internal_name: "Test",
  headline: "Regionale Fachleute",
  placement: "top_banner",
  targets: ["experts_directory"],
  requested_start_date: "2026-09-18",
  requested_end_date: "2026-10-01",
  body_text: "Qualität",
  target_url: "https://example.org",
};
const form = (overrides = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({ ...values, ...overrides })) {
    if (Array.isArray(v)) for (const item of v) f.append(k, item);
    else f.set(k, v);
  }
  return f;
};
const png = new File(
  [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
  "fake.svg",
  { type: "image/png" },
);
function client({
  authenticated = true,
  admin = false,
  status = "draft",
  foreign = false,
  rpcError = null,
  storedFile = png,
} = {}) {
  const calls = [];
  const row = { id, status, image_path: null, profile_id: "own-profile" };
  return {
    calls,
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: "owner" } : null },
        error: null,
      }),
    },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      return {
        select() {
          return this;
        },
        eq(k, v) {
          call.filters.push([k, v]);
          return this;
        },
        order() {
          return this;
        },
        async range() {
          return {
            data: foreign
              ? []
              : [{ ...row, company_profiles: { display_name: "Firma" } }],
            count: foreign ? 0 : 1,
            error: null,
          };
        },
        async maybeSingle() {
          return {
            data:
              table === "companies"
                ? { id: "own-company" }
                : table === "company_profiles"
                  ? {
                      id: "own-profile",
                      company_profile_categories: [
                        { category_id: "solar" },
                        { category_id: "elektro" },
                      ],
                    }
                  : table === "portal_admins"
                    ? admin
                      ? { user_id: "owner" }
                      : null
                    : foreign
                      ? null
                      : row,
            error: null,
          };
        },
      };
    },
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      return { error: rpcError };
    },
    storage: {
      from(bucket) {
        return {
          download: async (path) => {
            calls.push({ download: path });
            return { data: storedFile, error: null };
          },
          upload: async (path, file, options) => {
            calls.push({ upload: path, bucket, file, options });
            return { error: null };
          },
          remove: async (paths) => {
            calls.push({ remove: paths });
            return { error: null };
          },
          createSignedUrls: async (paths, ttl) => {
            calls.push({ sign: paths, ttl });
            return {
              data: paths.map((path) => ({
                path,
                signedUrl: `https://signed.test/${path}`,
                error: null,
              })),
              error: null,
            };
          },
        };
      },
    },
  };
}
test("ad validation rejects invalid URL, date, category and placement; derives states by Berlin date", () => {
  assert.ok(validateAdValues(form()).data);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "ftp://example.org",
    "https://",
    "https://user:pass@example.org",
    "https://exa mple.org",
  ]) {
    assert.equal(adTargetUrl(url), null);
    assert.ok(validateAdValues(form({ target_url: url })).error);
  }
  for (const data of [
    { internal_name: "" },
    { headline: "" },
    { body_text: "x".repeat(401) },
    { placement: "fake" },
    { targets: ["fake"] },
    { targets: ["trade:fake"] },
    { requested_start_date: "2026-02-30" },
    { requested_end_date: "2026-01-01" },
  ])
    assert.ok(validateAdValues(form(data)).error);
  assert.deepEqual(
    validateAdValues(form({ targets: ["experts_directory", "trade:solar"] }))
      .data.targets,
    [
      { target_type: "experts_directory", category_id: null },
      { target_type: "trade", category_id: "solar" },
    ],
  );
  assert.ok(validateAdValues(form({ targets: [] })).error);
  assert.ok(
    validateAdValues(form({ targets: ["trade:solar", "trade:solar"] })).error,
  );
  assert.equal(berlinToday(new Date("2026-09-17T22:30:00Z")), "2026-09-18");
  const c = {
    status: "approved",
    approved_start_date: "2026-09-18",
    approved_end_date: "2026-10-01",
  };
  assert.equal(adStatus(c, "2026-09-17"), "Geplant");
  assert.equal(adStatus(c, "2026-09-18"), "Aktiv");
  assert.equal(adStatus(c, "2026-10-01"), "Aktiv");
  assert.equal(adStatus(c, "2026-10-02"), "Abgelaufen");
  assert.equal(adStatus({ ...c, status: "paused" }, "2026-09-18"), "Pausiert");
});

test("direct Storage uploads are prepared for owner only and finalized using server-validated actual bytes", async () => {
  const ready = await prepareAdUpload(
    client(),
    form({ file_type: "image/png", file_size: 5242880 }),
  );
  assert.ok(ready.uploadPath);
  for (const options of [
    { authenticated: false },
    { foreign: true },
    { status: "pending" },
    { status: "approved" },
  ])
    assert.equal(
      (
        await prepareAdUpload(
          client(options),
          form({ file_type: "image/png", file_size: 12 }),
        )
      ).uploadPath,
      undefined,
    );
  for (const values of [
    { file_type: "image/svg+xml", file_size: 12 },
    { file_type: "image/png", file_size: 5242881 },
    { file_type: "image/png", file_size: 0 },
  ])
    assert.ok((await prepareAdUpload(client(), form(values))).error);
  const db = client();
  assert.ok(
    (
      await saveOwnAd(
        db,
        form({ uploaded_path: ready.uploadPath, intent: "submit" }),
      )
    ).success,
  );
  assert.equal(db.calls.filter((c) => c.download).length, 1);
  assert.ok(!db.calls.some((c) => c.upload));
  const forged = client();
  assert.ok(
    (
      await saveOwnAd(
        forged,
        form({
          uploaded_path: ready.uploadPath.replace(
            id,
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          ),
        }),
      )
    ).error,
  );
  assert.ok(!forged.calls.some((c) => c.download));
  for (const storedFile of [
    new File(["<svg/>"], "x", { type: "image/png" }),
    new File([new Uint8Array(5242881)], "x", { type: "image/png" }),
    new File(["GIF89a"], "x", { type: "image/gif" }),
  ]) {
    const invalid = client({ storedFile });
    assert.ok(
      (await saveOwnAd(invalid, form({ uploaded_path: ready.uploadPath })))
        .error,
    );
    assert.ok(!invalid.calls.some((c) => c.rpc));
    assert.ok(invalid.calls.some((c) => c.remove));
  }
  const mismatch = client();
  assert.ok(
    (
      await saveOwnAd(
        mismatch,
        form({ uploaded_path: ready.uploadPath.replace(/\.png$/, ".jpg") }),
      )
    ).error,
  );
});
test("ad uploads authenticate and isolate campaign before storage; accept signature and ignore forged ownership", async () => {
  const db = client();
  const result = await saveOwnAd(
    db,
    form({
      intent: "submit",
      image: png,
      profile_id: "foreign",
      image_path: "foreign/path",
      status: "approved",
      reviewed_by: "forged",
      admin_note: "forged",
    }),
  );
  assert.ok(result.success);
  const lookup = db.calls.find((c) => c.table === "company_ad_campaigns");
  assert.deepEqual(lookup.filters, [
    ["id", id],
    ["profile_id", "own-profile"],
  ]);
  const upload = db.calls.find((c) => c.upload);
  assert.match(
    upload.upload,
    new RegExp(`^campaigns/${id}/creative/[a-f0-9-]+\\.png$`),
  );
  assert.equal(upload.options.upsert, false);
  assert.equal(upload.bucket, "ad-media");
  const rpc = db.calls.find((c) => c.rpc);
  assert.equal(rpc.args.p_submit, true);
  assert.equal(rpc.args.p_data.image_path, upload.upload);
  for (const name of [
    "status",
    "profile_id",
    "admin_note",
    "reviewed_by",
    "approved_start_date",
  ])
    assert.equal(rpc.args.p_data[name], undefined);
});
test("ad uploads reject unsupported MIME, signature and oversize before writing anything", async () => {
  for (const image of [
    new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
    new File(["%PDF"], "x.png", { type: "image/png" }),
    new File([new Uint8Array(5242881)], "x.png", { type: "image/png" }),
    new File(["GIF89a"], "x.gif", { type: "image/gif" }),
  ]) {
    const db = client();
    assert.ok((await saveOwnAd(db, form({ image }))).error);
    assert.ok(!db.calls.some((c) => c.upload || c.rpc));
  }
  for (const options of [
    { authenticated: false },
    { foreign: true },
    { status: "pending" },
    { status: "approved" },
    { status: "paused" },
  ]) {
    const db = client(options);
    const result = await saveOwnAd(db, form({ image: png }));
    assert.ok(result.error || result.unauthenticated);
    assert.ok(!db.calls.some((c) => c.upload || c.rpc));
  }
  const missing = await saveOwnAd(client(), form({ intent: "submit" }));
  assert.ok(missing.error);
});
test("ad failed save cleans new object; admin decisions are fixed RPCs and conflicts are understandable", async () => {
  const db = client({ rpcError: { message: "private" } });
  assert.ok((await saveOwnAd(db, form({ image: png }))).error);
  assert.ok(db.calls.some((c) => c.remove));
  const owner = client();
  assert.equal(
    (await decideAd(owner, form({ decision: "approve" }))).access,
    "forbidden",
  );
  assert.ok(!owner.calls.some((c) => c.rpc));
  const admin = client({
    admin: true,
    rpcError: { message: "ad_booking_conflict" },
  });
  const result = await decideAd(
    admin,
    form({
      decision: "approve",
      approved_start_date: "2026-09-18",
      approved_end_date: "2026-10-01",
    }),
  );
  assert.match(result.error, /bereits belegt/);
  assert.equal(admin.calls.find((c) => c.rpc).rpc, "review_ad_campaign");
});
test("ad reads explicitly restrict own profile, admin queue checks membership, image signing is batched", async () => {
  const own = client();
  await loadAdCampaigns(own);
  assert.deepEqual(
    own.calls.find((c) => c.table === "company_ad_campaigns").filters,
    [["profile_id", "own-profile"]],
  );
  const denied = client();
  assert.equal((await loadAdCampaigns(denied, true)).access, "forbidden");
  assert.ok(!denied.calls.some((c) => c.table === "company_ad_campaigns"));
  const db = client();
  const rows = [1, 2, 3, 4].map((n) => ({
    id: `id${n}`,
    image_path: `campaigns/id${n}/creative/file.png`,
  }));
  const signed = await signAdImages(db, rows);
  assert.equal(db.calls.filter((c) => c.sign).length, 1);
  assert.equal(signed.length, 4);
  assert.ok(signed.every((c) => c.imageUrl));
});

test("server action rejects a canonical but unassigned trade before media or RPC mutation", async () => {
  const db = client();
  const result = await saveOwnAd(
    db,
    form({ targets: ["experts_directory", "trade:dach"], image: png }),
  );
  assert.match(result.error, /zugeordneten Gewerken/);
  assert.ok(!db.calls.some((c) => c.rpc || c.upload || c.download));
  const allowed = client();
  assert.ok(
    (
      await saveOwnAd(
        allowed,
        form({
          targets: ["experts_directory", "trade:solar", "trade:elektro"],
          image: png,
        }),
      )
    ).success,
  );
  assert.equal(allowed.calls.find((c) => c.rpc).args.p_data.targets.length, 3);
});
