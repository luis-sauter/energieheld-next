import test from "node:test";
import assert from "node:assert/strict";
import {
  changeOwnCompanyMedia,
  validateMediaFile,
  signCompanyMedia,
  MEDIA_MAX_BYTES,
} from "../src/lib/company-media.ts";
const png = new File(
  [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
  "untrusted/evil.svg",
  { type: "image/png" },
);
const row = (i = 0) => ({
  id: `image-${i}`,
  storage_path: `profiles/own-profile/gallery/file-${i}.png`,
  sort_order: i,
  alt_text: null,
});
const form = (values = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    intent: "logo-upload",
    file: png,
    ...values,
  }))
    f.set(k, v);
  return f;
};
function client({
  authenticated = true,
  rows = [],
  logo = "profiles/own-profile/logo/old.png",
  missingCompany = false,
  writeError = false,
  uploadError = false,
  deleteError = false,
  downloadFile = png,
} = {}) {
  const events = [];
  return {
    events,
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: "verified-user" } : null },
        error: null,
      }),
    },
    from(table) {
      const q = { table, filters: [] };
      events.push(q);
      return {
        select() {
          return this;
        },
        eq(k, v) {
          q.filters.push([k, v]);
          return this;
        },
        is(k, v) {
          q.filters.push([k, v]);
          return this;
        },
        update(v) {
          q.action = "update";
          q.payload = v;
          return this;
        },
        insert(v) {
          q.action = "insert";
          q.payload = v;
          return this;
        },
        delete() {
          q.action = "delete";
          return this;
        },
        async maybeSingle() {
          if (q.action)
            return {
              data: writeError ? null : { id: "saved" },
              error: writeError ? { message: "secret db error" } : null,
            };
          return {
            error: null,
            data:
              table === "companies"
                ? missingCompany
                  ? null
                  : { id: "own-company" }
                : {
                    id: "own-profile",
                    logo_path: logo,
                    company_profile_images: rows.map((r) => ({ ...r })),
                  },
          };
        },
      };
    },
    rpc: async (name, payload) => {
      events.push({ action: "rpc", name, payload });
      return { error: null };
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "company-media");
        return {
          download: async (path) => {
            events.push({ action: "download", path });
            return { data: downloadFile, error: null };
          },
          upload: async (path, file, options) => {
            events.push({ action: "upload", path, file, options });
            return { error: uploadError ? {} : null };
          },
          remove: async (paths) => {
            events.push({ action: "remove", paths });
            return { error: deleteError ? {} : null };
          },
          createSignedUrls: async (paths, ttl) => {
            events.push({ action: "sign", paths, ttl });
            return {
              data: paths.map((path) => ({
                path,
                signedUrl: `https://media.test/${path}?token=temporary`,
              })),
              error: null,
            };
          },
        };
      },
    },
  };
}
test("server file validation accepts jpeg/png/webp signatures only", async () => {
  for (const file of [
    png,
    new File([new Uint8Array([255, 216, 255, 0])], "x.jpg", {
      type: "image/jpeg",
    }),
    new File(["RIFF0000WEBP"], "x.webp", { type: "image/webp" }),
  ])
    assert.ok((await validateMediaFile(file)).file);
  for (const type of ["image/svg+xml", "image/gif", "application/pdf"])
    assert.ok(
      (await validateMediaFile(new File(["content"], "x", { type }))).error,
    );
  assert.ok(
    (
      await validateMediaFile(
        new File(["<svg/>"], "fake.png", { type: "image/png" }),
      )
    ).error,
  );
  assert.ok(
    (await validateMediaFile(new File([], "empty.png", { type: "image/png" })))
      .error,
  );
  assert.ok((await validateMediaFile(null)).error);
  assert.match(
    (
      await validateMediaFile(
        new File([new Uint8Array(MEDIA_MAX_BYTES + 1)], "large.png", {
          type: "image/png",
        }),
      )
    ).error,
    /5 MB/,
  );
});
test("unauthenticated and missing ownership stop uploads", async () => {
  const unauth = client({ authenticated: false });
  assert.deepEqual(await changeOwnCompanyMedia(unauth, form()), {
    unauthenticated: true,
  });
  assert.equal(unauth.events.length, 0);
  const missing = client({ missingCompany: true });
  assert.ok((await changeOwnCompanyMedia(missing, form())).error);
  assert.ok(!missing.events.some((e) => e.action === "upload"));
});
test("logo replacement derives ownership server-side, uses random path, writes DB before removing old object", async () => {
  const db = client();
  const result = await changeOwnCompanyMedia(
    db,
    form({
      profile_id: "foreign",
      company_id: "foreign",
      logo_path: "forged",
      status: "approved",
    }),
  );
  assert.ok(result.success);
  assert.deepEqual(db.events[0].filters, [["owner_user_id", "verified-user"]]);
  assert.deepEqual(db.events[1].filters, [["company_id", "own-company"]]);
  const upload = db.events.find((e) => e.action === "upload");
  assert.match(
    upload.path,
    /^profiles\/own-profile\/logo\/[0-9a-f-]{36}\.png$/,
  );
  assert.equal(upload.options.upsert, false);
  const write = db.events.find((e) => e.action === "update");
  assert.deepEqual(write.payload, { logo_path: upload.path });
  assert.ok(write.filters.some(([k, v]) => k === "id" && v === "own-profile"));
  assert.deepEqual(db.events.at(-1), {
    action: "remove",
    paths: ["profiles/own-profile/logo/old.png"],
  });
});
test("failed metadata write cleans uploaded object; failed upload never writes metadata", async () => {
  const db = client({ writeError: true });
  const result = await changeOwnCompanyMedia(db, form());
  assert.ok(result.error);
  assert.doesNotMatch(result.error, /secret/);
  assert.deepEqual(db.events.at(-1).paths, [
    db.events.find((e) => e.action === "upload").path,
  ]);
  const failed = client({ uploadError: true });
  assert.ok((await changeOwnCompanyMedia(failed, form())).error);
  assert.ok(!failed.events.some((e) => e.action === "update"));
});
test("logo removal detaches first and tolerates storage cleanup failure", async () => {
  const db = client({ deleteError: true });
  assert.ok(
    (await changeOwnCompanyMedia(db, form({ intent: "logo-remove" }))).success,
  );
  assert.deepEqual(db.events.find((e) => e.action === "update").payload, {
    logo_path: null,
  });
  assert.equal(db.events.at(-1).action, "remove");
});
test("gallery upload checks limit and stores only object path, original alt text and sort position", async () => {
  const full = client({ rows: Array.from({ length: 8 }, (_, i) => row(i)) });
  assert.match(
    (await changeOwnCompanyMedia(full, form({ intent: "gallery-upload" })))
      .error,
    /8/,
  );
  assert.ok(!full.events.some((e) => e.action === "upload"));
  const db = client({ rows: [row(3)] });
  assert.ok(
    (
      await changeOwnCompanyMedia(
        db,
        form({ intent: "gallery-upload", alt_text: " Unser Betrieb " }),
      )
    ).success,
  );
  const write = db.events.find((e) => e.action === "insert");
  assert.equal(write.payload.profile_id, "own-profile");
  assert.equal(write.payload.sort_order, 4);
  assert.equal(write.payload.alt_text, "Unser Betrieb");
  assert.match(write.payload.storage_path, /^profiles\/own-profile\/gallery\//);
  assert.doesNotMatch(JSON.stringify(write.payload), /https:|token=/);
});
test("gallery deletion rejects foreign image IDs and deletes metadata before storage", async () => {
  const db = client({ rows: [row()] });
  assert.ok(
    (
      await changeOwnCompanyMedia(
        db,
        form({ intent: "gallery-remove", image_id: "foreign" }),
      )
    ).error,
  );
  assert.ok(!db.events.some((e) => e.action === "delete"));
  assert.ok(
    (
      await changeOwnCompanyMedia(
        db,
        form({ intent: "gallery-remove", image_id: "image-0" }),
      )
    ).success,
  );
  assert.deepEqual(db.events.find((e) => e.action === "delete").filters, [
    ["profile_id", "own-profile"],
    ["id", "image-0"],
  ]);
  assert.equal(db.events.at(-1).action, "remove");
});
test("gallery reorder sends complete server-derived IDs atomically, ignoring forged profile/order", async () => {
  const db = client({ rows: [row(), row(1), row(2)] });
  assert.ok(
    (
      await changeOwnCompanyMedia(
        db,
        form({
          intent: "gallery-up",
          image_id: "image-1",
          profile_id: "foreign",
          order: "forged",
        }),
      )
    ).success,
  );
  assert.deepEqual(db.events.at(-1), {
    action: "rpc",
    name: "reorder_company_images",
    payload: {
      p_profile_id: "own-profile",
      p_image_ids: ["image-1", "image-0", "image-2"],
    },
  });
});
test("signed media URLs use one-hour lifetime, sorted gallery and generated alt text; never persisted", async () => {
  const db = client();
  const media = await signCompanyMedia(db, {
    id: "own-profile",
    display_name: "Firma",
    logo_path: "profiles/own-profile/logo/logo.png",
    company_profile_images: [row(2), { ...row(0), alt_text: "Team" }],
  });
  assert.equal(media.logo.alt, "Logo von Firma");
  assert.deepEqual(
    media.images.map((i) => i.alt),
    ["Team", "Unternehmensbild von Firma"],
  );
  assert.equal(db.events[0].ttl, 3600);
  assert.equal(db.events.length, 1);
  assert.deepEqual(
    await signCompanyMedia(db, { id: "own-profile", display_name: "Firma" }),
    { images: [] },
  );
  await assert.rejects(
    signCompanyMedia(db, {
      id: "other",
      display_name: "Firma",
      logo_path: "profiles/foreign/logo/x.png",
    }),
  );
});

test("direct upload preparation verifies ownership and metadata without transferring binary data through actions", async () => {
  const db = client();
  const result = await changeOwnCompanyMedia(
    db,
    form({
      intent: "prepare-logo",
      file_type: "image/png",
      file_size: String(MEDIA_MAX_BYTES),
      profile_id: "foreign",
    }),
  );
  assert.match(
    result.uploadPath,
    /^profiles\/own-profile\/logo\/[0-9a-f-]{36}\.png$/,
  );
  assert.ok(!db.events.some((e) => e.action));
  for (const values of [
    { file_type: "image/svg+xml" },
    { file_size: String(MEDIA_MAX_BYTES + 1) },
    { file_size: "0" },
  ])
    assert.ok(
      (
        await changeOwnCompanyMedia(
          db,
          form({
            intent: "prepare-logo",
            file_type: "image/png",
            file_size: "100",
            ...values,
          }),
        )
      ).error,
    );
});
test("direct 5MB upload is downloaded and verified on the server before metadata publication", async () => {
  const bytes = new Uint8Array(MEDIA_MAX_BYTES);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const db = client({
    downloadFile: new File([bytes], "large.png", { type: "image/png" }),
  });
  const path =
    "profiles/own-profile/logo/11111111-1111-4111-8111-111111111111.png";
  const result = await changeOwnCompanyMedia(db, form({ uploaded_path: path }));
  assert.ok(result.success);
  assert.ok(db.events.some((e) => e.action === "download" && e.path === path));
  assert.ok(!db.events.some((e) => e.action === "upload"));
  assert.deepEqual(db.events.find((e) => e.action === "update").payload, {
    logo_path: path,
  });
});
test("direct uploaded foreign paths and spoofed file bytes cannot be finalized", async () => {
  const db = client();
  assert.ok(
    (
      await changeOwnCompanyMedia(
        db,
        form({
          uploaded_path:
            "profiles/foreign/logo/11111111-1111-4111-8111-111111111111.png",
        }),
      )
    ).error,
  );
  assert.ok(!db.events.some((e) => e.action));
  const bad = client({
    downloadFile: new File(["<svg/>"], "fake.png", { type: "image/png" }),
  });
  const path =
    "profiles/own-profile/logo/11111111-1111-4111-8111-111111111111.png";
  assert.ok(
    (await changeOwnCompanyMedia(bad, form({ uploaded_path: path }))).error,
  );
  assert.ok(!bad.events.some((e) => e.action === "update"));
  assert.deepEqual(bad.events.at(-1).paths, [path]);
});
