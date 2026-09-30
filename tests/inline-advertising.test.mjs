import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { inlineAdContext, matchesInlineAdContext } = await import("../src/lib/inline-ad-context.ts");
const { prepareInlineAdUpload, saveInlineAd } = await import("../src/lib/inline-advertising.ts");
const { adPlacements, berlinToday } = await import("../src/lib/ad-values.ts");
const { travelThemes, destinations } = await import("../src/data/reiseportal-discovery.ts");

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const image = `campaigns/${id}/creative/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`;
const target = (key = "mottoreisen/wellnessangebote", placement = "top_banner") => ({ target_type: "portal_area", category_id: null, target_key: key, placement });
const form = (values = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ campaign_id: id, placement: "top_banner", target_url: "https://example.org/new", ...values })) data.set(key, value);
  return data;
};

function client({ authenticated = true, admin = true, campaign = {}, saveError = null, reviewError = null } = {}) {
  const calls = [];
  const row = { id, is_editorial: false, profile_id: "existing-company", status: "approved", image_path: image,
    internal_name: "Existing", headline: "Existing image alt", body_text: "Existing text", target_url: "https://example.org/old",
    requested_start_date: "2026-09-01", requested_end_date: "2026-12-31", approved_start_date: "2026-09-01", approved_end_date: "2026-12-31",
    contact_name: "Existing contact", contact_phone: "+49 123", contact_email: "info@example.org", targets: [target()], ...campaign };
  return { calls, row,
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "verified-admin", user_metadata: { role: "admin" } } : null }, error: null }) },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      return { select(columns) { call.columns = columns; return this; }, eq(key, value) { call.filters.push([key,value]); return this; },
        async maybeSingle() { return { data: table === "portal_admins" ? admin ? { user_id: "verified-admin" } : null : structuredClone(row), error: null }; } };
    },
    async rpc(name, data) {
      calls.push({ rpc: name, data });
      if (name === "create_editorial_ad_campaign") {
        Object.assign(row, { is_editorial: true, profile_id: null, status: "draft", image_path: null, internal_name: "", headline: "",
          requested_start_date: berlinToday(), requested_end_date: berlinToday(), approved_start_date: null, approved_end_date: null,
          targets: [{ target_type: data.p_target_type, target_key: data.p_target_key, category_id: null, placement: data.p_placement }] });
        return { data: id, error: null };
      }
      if (name === "save_ad_campaign") {
        if (saveError) return { error: saveError };
        Object.assign(row, data.p_data); if (data.p_submit) row.status = "pending";
      }
      if (name === "review_ad_campaign") {
        if (reviewError) return { error: reviewError };
        row.status = "approved"; row.approved_start_date = data.p_start; row.approved_end_date = data.p_end;
      }
      return { data: null, error: null };
    },
    storage: { from(bucket) {
      calls.push({ bucket });
      return {
        async download(path) { calls.push({ download: path }); return { data: new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1EAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), error: null }; },
        async remove(paths) { calls.push({ remove: paths }); return { error: null }; },
        async createSignedUrls(paths) { calls.push({ sign: paths }); return { data: paths.map((path) => ({ path, signedUrl: `https://private.example.org/${path}` })), error: null }; },
      };
    } },
  };
}

test("inline contexts accept only real homepage, directory, 12 themes and four destinations", () => {
  const paths = ["/", "/unterkuenfte-a-z", "/mottoreisen", "/reiseziele", ...travelThemes.map((item) => `/mottoreisen/${item.slug}`), ...destinations.map((item) => `/reiseziele/${item.slug}`)];
  assert.equal(paths.length, 20);
  for (const path of paths) assert.equal(inlineAdContext(path)?.path, path);
  for (const path of ["/admin", "/experten/foo", "/mottoreisen/fake", "/reiseziele/fake", "/reiseziele/deutschland/", "/?page=admin"]) assert.equal(inlineAdContext(path), null);
  assert.equal(matchesInlineAdContext(target(), inlineAdContext("/mottoreisen/wellnessangebote")), true);
  assert.equal(matchesInlineAdContext(target("mottoreisen/wanderurlaub"), inlineAdContext("/mottoreisen/wellnessangebote")), false);
});

test("visitor and ordinary account cannot prepare uploads or save even with admin metadata", async () => {
  for (const options of [{ authenticated: false }, { admin: false }]) {
    const db = client(options);
    assert.ok((await prepareInlineAdUpload(db, "/mottoreisen/wellnessangebote", form())).error);
    assert.ok((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form())).error);
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
});

test("forged foreign-context campaign IDs and unknown context perform no mutation", async () => {
  for (const path of ["/mottoreisen/wanderurlaub", "/reiseziele/deutschland", "/invalid"]) {
    const db = client();
    assert.ok((await prepareInlineAdUpload(db, path, form())).error);
    assert.ok((await saveInlineAd(db, path, form())).error);
    assert.ok(!db.calls.some((call) => call.rpc || call.bucket));
  }
});

test("admin without a company prepares all thirteen existing places using the bound context", async () => {
  for (const placement of Object.keys(adPlacements)) {
    const db = client();
    const prepared = await prepareInlineAdUpload(db, "/reiseziele/oesterreich", form({ campaign_id: "", placement, file_type: "image/png", file_size: "100" }));
    assert.equal(prepared.campaignId, id);
    assert.match(prepared.uploadPath, new RegExp(`^campaigns/${id}/creative/[a-f0-9-]+\\.png$`));
    assert.deepEqual(db.calls.find((call) => call.rpc === "create_editorial_ad_campaign").data,
      { p_target_type: "portal_area", p_target_key: "reiseziele/oesterreich", p_placement: placement });
    assert.ok(!db.calls.some((call) => ["companies", "company_profiles"].includes(call.table)));
    assert.equal(db.row.profile_id, null);
  }
});

test("invalid URL, placement or file metadata creates no draft or upload", async () => {
  for (const values of [{ target_url: "javascript:alert(1)" }, { placement: "sidebar_13" }, { file_type: "image/svg+xml" }, { file_size: "6000000" }]) {
    const db = client();
    const result = await prepareInlineAdUpload(db, "/", form({ campaign_id: "", file_type: "image/png", file_size: "100", ...values }));
    assert.ok(result.error); assert.ok(!db.calls.some((call) => call.rpc || call.bucket));
  }
});

test("existing single-target campaign preserves company, dates, contacts and metadata while editing exact context", async () => {
  const db = client();
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ placement: "sidebar_12", targets: "homepage|top_banner", profile_id: "forged", internal_name: "forged", requested_end_date: "9999-12-31" }));
  assert.ok(result.success);
  const saved = db.calls.find((call) => call.rpc === "save_ad_campaign").data;
  assert.deepEqual(saved.p_data.targets, [target("mottoreisen/wellnessangebote", "sidebar_12")]);
  assert.equal(saved.p_data.internal_name, "Existing"); assert.equal(saved.p_data.contact_name, "Existing contact");
  assert.equal(saved.p_data.requested_end_date, "2026-12-31"); assert.equal(db.row.profile_id, "existing-company");
  assert.equal(result.ad.placement, "sidebar_12"); assert.ok(result.ad.imageUrl);
  assert.equal(saved.p_submit, false); assert.ok(!db.calls.some((call) => call.rpc === "review_ad_campaign"));
});

test("new editorial creative reuses secure byte validation and existing publication RPC", async () => {
  const db = client();
  const input = form({ campaign_id: "", file_type: "image/png", file_size: "100" });
  const prepared = await prepareInlineAdUpload(db, "/mottoreisen/wellnessangebote", input);
  input.set("uploaded_path", prepared.uploadPath);
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", input);
  assert.ok(result.success, result.error);
  assert.equal(db.row.status, "approved"); assert.equal(db.row.profile_id, null);
  assert.equal(db.row.approved_start_date, berlinToday()); assert.equal(db.row.approved_end_date, "9999-12-31");
  assert.equal(db.row.targets.length, 1);
  assert.equal(db.calls.filter((call) => call.download).length, 1);
  assert.equal(db.calls.filter((call) => call.rpc === "review_ad_campaign").length, 1);
});

test("shared campaigns are not altered inline and report the existing management path", async () => {
  const db = client({ campaign: { targets: [target(), target("mottoreisen/wanderurlaub")] } });
  assert.match((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form())).error, /mehreren Bereichen/);
  assert.match((await prepareInlineAdUpload(db, "/mottoreisen/wellnessangebote", form())).error, /mehreren Bereichen/);
  assert.ok(!db.calls.some((call) => call.rpc || call.bucket));
});

test("foreign media reference rejected before storage read or save", async () => {
  const db = client();
  assert.ok((await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ uploaded_path: "campaigns/foreign/creative/file.png" }))).error);
  assert.ok(!db.calls.some((call) => call.download || call.rpc));
});

test("conflict returns error without approval and storage replacement cleanup stays in existing helper", async () => {
  const db = client({ saveError: { message: "ad_booking_conflict" } });
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", form({ uploaded_path: image }));
  assert.match(result.error, /belegt/);
  assert.ok(!db.calls.some((call) => call.rpc === "review_ad_campaign"));
  assert.ok(db.calls.some((call) => call.remove?.includes(image)));
});

test("approval failure does not claim public success and keeps saved pending creative", async () => {
  const db = client({ campaign: { status: "pending" }, reviewError: { message: "ad_booking_conflict" } });
  const result = await saveInlineAd(db, "/mottoreisen/wellnessangebote", form());
  assert.ok(result.error); assert.equal(result.success, undefined); assert.equal(db.row.status, "pending");
});
