import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { changeAdminProfileContent } = await import("../src/lib/admin-profile-content.ts");

const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const block = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const image = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = `profiles/${profile}/blocks/${block}/${image}.jpg`;
function client({ storageFails = false } = {}) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: "editor" } }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      return {
        select() { return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        is(key, value) { call.filters.push([key, value]); return this; },
        delete() { call.operation = "delete"; return this; },
        async maybeSingle() {
          if (table === "portal_admins") return { data: { user_id: "editor" }, error: null };
          if (table === "company_profiles") return { data: { id: profile }, error: null };
          if (table === "profile_content_blocks") return { data: call.operation === "delete" ? { id: block } : { id: block, type: "image_grid", slot: null }, error: null };
          return { data: null, error: null };
        },
        then(resolve) { return resolve({ data: [{ id: image, storage_path: path }], error: null }); },
      };
    },
    async rpc(name, args) { calls.push({ operation: "rpc", name, args }); return { data: path, error: null }; },
    storage: { from(bucket) {
      assert.equal(bucket, "company-media");
      return {
        list: async (prefix) => {
          calls.push({ operation: "list", prefix });
          return { data: calls.some((call) => call.operation === "remove") ? [] : [{ name: `${image}.jpg` }], error: null };
        },
        remove: async (paths) => { calls.push({ operation: "remove", paths }); return { error: storageFails ? { message: "storage" } : null }; },
      };
    } },
  };
}

test("deleting an image block removes only its referenced image and private file before the block", async () => {
  const db = client();
  const form = new FormData();
  form.set("intent", "delete");
  form.set("block_id", block);
  const result = await changeAdminProfileContent(db, profile, "sichtbar", form);
  assert.ok(result.success);
  const imageRemoval = db.calls.findIndex((call) => call.operation === "rpc");
  const storageRemoval = db.calls.findIndex((call) => call.operation === "remove");
  const blockRemoval = db.calls.findIndex((call) => call.operation === "delete");
  assert.ok(imageRemoval < storageRemoval && storageRemoval < blockRemoval);
  assert.deepEqual(db.calls[imageRemoval].args, { p_profile_id: profile, p_block_id: block, p_image_id: image });
  assert.deepEqual(db.calls[storageRemoval].paths, [path]);
  assert.ok(db.calls[blockRemoval].filters.some(([key, value]) => key === "profile_id" && value === profile));
});

test("failed Storage cleanup keeps the block available for a retry", async () => {
  const db = client({ storageFails: true });
  const form = new FormData();
  form.set("intent", "delete");
  form.set("block_id", block);
  assert.ok((await changeAdminProfileContent(db, profile, "sichtbar", form)).error);
  assert.ok(!db.calls.some((call) => call.operation === "delete"));
});
