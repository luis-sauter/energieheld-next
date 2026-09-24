import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { changeAdminBlockImages } = await import("../src/lib/admin-block-images.ts");
const { moveImageId } = await import("../src/lib/media-order.ts");

const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignProfile = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const block = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const foreignBlock = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const imageId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const foreignImage = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const oldPath = `profiles/${profile}/blocks/${block}/${imageId}.png`;
const newPath = `profiles/${profile}/blocks/${block}/11111111-1111-4111-8111-111111111111.png`;
const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], { type: "image/png" });
function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else data.set(key, value);
  }
  return data;
}
function client({ admin = true, authenticated = true, columns = 2, rows = [
  { id: imageId, block_id: block, storage_path: oldPath, sort_order: 0 },
], download = png, writeError = false } = {}) {
  const calls = [];
  const db = {
    calls,
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "editor" } : null }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        is(key, value) { call.filters.push([key, value]); return this; },
        order(key) { call.order = [...(call.order ?? []), key]; return this; },
        update(payload) { call.operation = "update"; call.payload = payload; return this; },
        insert(payload) { call.operation = "insert"; call.payload = payload; return this; },
        async maybeSingle() {
          if (table === "portal_admins") return { data: admin ? { user_id: "editor" } : null, error: null };
          if (table === "company_profiles") {
            const valid = call.filters.some(([key, value]) => key === "id" && value === profile) &&
              call.filters.some(([key, value]) => key === "slug" && value === "sichtbar");
            return { data: valid ? { id: profile } : null, error: null };
          }
          if (call.operation) return { data: writeError ? null : { id: call.filters.find(([key]) => key === "id")?.[1] ?? imageId }, error: writeError ? { message: "db" } : null };
          if (table === "profile_content_blocks") {
            const valid = call.filters.some(([key, value]) => key === "id" && value === block) &&
              call.filters.some(([key, value]) => key === "profile_id" && value === profile);
            return { data: valid ? { id: block, type: "image_grid", config: { columns } } : null, error: null };
          }
          return { data: null, error: null };
        },
        then(resolve) {
          return resolve({ data: rows.filter((row) => call.filters.every(([key, value]) => row[key] === value)), error: null });
        },
      };
      return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, "company-media");
      return {
        download: async (path) => { calls.push({ operation: "download", path }); return { data: download, error: null }; },
        remove: async (paths) => { calls.push({ operation: "remove", paths }); return { error: null }; },
      };
    } },
    rpc: async (name, args) => { calls.push({ operation: "rpc", name, args }); return { data: name === "remove_profile_block_image" ? oldPath : null, error: null }; },
  };
  return db;
}

test("only portal admins reach block-image mutations and forged profile/slug/block are rejected", async () => {
  for (const options of [{ admin: false }, { authenticated: false }]) {
    const db = client(options);
    assert.notEqual((await changeAdminBlockImages(db, profile, "sichtbar", form({ intent: "layout", block_id: block, columns: "2" }))).access, "admin");
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
  for (const [id, slug, blockId] of [[foreignProfile, "sichtbar", block], [profile, "fremd", block], [profile, "sichtbar", foreignBlock]]) {
    const db = client();
    assert.ok((await changeAdminBlockImages(db, id, slug, form({ intent: "layout", block_id: blockId, columns: "2" }))).error);
    assert.ok(!db.calls.some((call) => call.operation === "update"));
  }
});

test("upload preparation binds a random private path to the displayed profile and block", async () => {
  const db = client();
  const result = await changeAdminBlockImages(db, profile, "sichtbar", form({
    intent: "prepare", block_id: block, file_type: "image/png", file_size: "100", profile_id: foreignProfile,
  }));
  assert.match(result.uploadPath, new RegExp(`^profiles/${profile}/blocks/${block}/[0-9a-f-]{36}\\.png$`));
  for (const [file_type, file_size] of [["image/svg+xml", "100"], ["image/png", "5242881"], ["image/png", "0"]]) {
    const rejected = await changeAdminBlockImages(client(), profile, "sichtbar", form({ intent: "prepare", block_id: block, file_type, file_size }));
    assert.ok(rejected.error);
  }
  const full = client({ columns: 1 });
  assert.ok((await changeAdminBlockImages(full, profile, "sichtbar", form({ intent: "prepare", block_id: block, file_type: "image/png", file_size: "100" }))).error);
});

test("upload checks path, bytes and alt text before inserting an image", async () => {
  for (const path of [`profiles/${foreignProfile}/blocks/${block}/11111111-1111-4111-8111-111111111111.png`,
    `profiles/${profile}/blocks/${foreignBlock}/11111111-1111-4111-8111-111111111111.png`,
    `profiles/${profile}/blocks/${block}/11111111-1111-4111-8111-111111111111.svg`]) {
    const db = client({ rows: [] });
    assert.ok((await changeAdminBlockImages(db, profile, "sichtbar", form({ intent: "upload", block_id: block, uploaded_path: path, alt_text: "" }))).error);
    assert.ok(!db.calls.some((call) => call.operation === "download"));
  }
  const bad = client({ rows: [], download: new Blob(["<svg/>"], { type: "image/png" }) });
  assert.ok((await changeAdminBlockImages(bad, profile, "sichtbar", form({ intent: "upload", block_id: block, uploaded_path: newPath, alt_text: "" }))).error);
  assert.ok(!bad.calls.some((call) => call.operation === "insert"));
  const db = client({ rows: [] });
  assert.ok((await changeAdminBlockImages(db, profile, "sichtbar", form({ intent: "upload", block_id: block, uploaded_path: newPath, alt_text: "  Dachansicht  " }))).success);
  const insert = db.calls.find((call) => call.operation === "insert");
  assert.deepEqual(insert.payload, { block_id: block, storage_path: newPath, alt_text: "Dachansicht", sort_order: 0 });
});

test("replacement preserves the image row, detaches old path and then cleans it", async () => {
  const db = client();
  assert.ok((await changeAdminBlockImages(db, profile, "sichtbar", form({ intent: "upload", block_id: block, image_id: imageId, uploaded_path: newPath, alt_text: "Neu" }))).success);
  const update = db.calls.find((call) => call.operation === "update");
  assert.deepEqual(update.payload, { storage_path: newPath, alt_text: "Neu" });
  assert.ok(update.filters.some(([key, value]) => key === "block_id" && value === block));
  assert.deepEqual(db.calls.at(-1), { operation: "remove", paths: [oldPath] });
  const rejected = client();
  assert.ok((await changeAdminBlockImages(rejected, profile, "sichtbar", form({ intent: "upload", block_id: block, image_id: foreignImage, uploaded_path: newPath, alt_text: "" }))).error);
  assert.ok(!rejected.calls.some((call) => call.operation === "download"));
});

test("layout, alt, delete and exact reorder stay scoped to the block", async () => {
  const db = client();
  assert.ok((await changeAdminBlockImages(db, profile, "sichtbar", form({ intent: "layout", block_id: block, columns: "1" }))).success);
  assert.deepEqual(db.calls.find((call) => call.operation === "update")?.payload, { config: { columns: 1 } });
  const small = client({ columns: 4, rows: [
    { id: imageId, block_id: block, storage_path: oldPath, sort_order: 0 },
    { id: foreignImage, block_id: block, storage_path: newPath, sort_order: 1 },
  ] });
  assert.ok((await changeAdminBlockImages(small, profile, "sichtbar", form({ intent: "layout", block_id: block, columns: "1" }))).error);
  assert.ok(!small.calls.some((call) => call.operation === "update"));
  assert.ok((await changeAdminBlockImages(client(), profile, "sichtbar", form({ intent: "alt", block_id: block, image_id: foreignImage, alt_text: "hack" }))).error);
  assert.ok((await changeAdminBlockImages(client(), profile, "sichtbar", form({ intent: "reorder", block_id: block, image_ids: [foreignImage] }))).error);
  const ordered = client();
  assert.ok((await changeAdminBlockImages(ordered, profile, "sichtbar", form({ intent: "reorder", block_id: block, image_ids: [imageId] }))).success);
  assert.deepEqual(ordered.calls.find((call) => call.operation === "rpc")?.args, { p_profile_id: profile, p_block_id: block, p_image_ids: [imageId] });
  const removed = client();
  assert.ok((await changeAdminBlockImages(removed, profile, "sichtbar", form({ intent: "remove", block_id: block, image_id: imageId }))).success);
  assert.deepEqual(removed.calls.at(-1), { operation: "remove", paths: [oldPath] });
});

test("drag and arrow controls share the same order operation", () => {
  const ids = ["A", "B", "C"];
  assert.deepEqual(moveImageId(ids, "C", "A"), ["C", "A", "B"]);
  assert.deepEqual(moveImageId(ids, "C", "B"), ["A", "C", "B"]);
  assert.deepEqual(ids, ["A", "B", "C"]);
});
