import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { changeAdminProfileContent } = await import("../src/lib/admin-profile-content.ts");

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const slug = "sichtbares-profil";
const aboutId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const textId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const imageId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const otherId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function form(values) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}

function client({ admin = true } = {}) {
  const rows = [
    { id: aboutId, profile_id: profileId, type: "heading", slot: "about_heading", sort_order: 0,
      content: { text: "Über Profil" }, config: {} },
    { id: textId, profile_id: profileId, type: "text", slot: null, sort_order: 0,
      content: { text: "Reisetext" }, config: { width_percent: 100, offset_percent: 0,
        text_align: "left", spacing_top: "normal", spacing_bottom: "normal" } },
    { id: otherId, profile_id: "ffffffff-ffff-4fff-8fff-ffffffffffff", type: "text", slot: null,
      sort_order: 0, content: { text: "Fremd" }, config: { width_percent: 100, offset_percent: 0,
        text_align: "left", spacing_top: "normal", spacing_bottom: "normal" } },
  ];
  const calls = [];
  return {
    rows, calls,
    auth: { getUser: async () => ({ data: { user: { id: "editor" } }, error: null }) },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const matches = (row) => call.filters.every(([key, value]) => row[key] === value);
      const query = {
        select() { return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        is(key, value) { call.filters.push([key, value]); return this; },
        order() { return this; },
        update(payload) { call.operation = "update"; call.payload = payload; return this; },
        delete() { call.operation = "delete"; return this; },
        insert(payload) { call.operation = "insert"; call.payload = payload; return this; },
        async maybeSingle() {
          if (table === "portal_admins") return { data: admin ? { user_id: "editor" } : null, error: null };
          if (table === "company_profiles") return { data: call.filters.some(([key, value]) => key === "id" && value === profileId) &&
            call.filters.some(([key, value]) => key === "slug" && value === slug)
            ? { id: profileId } : null, error: null };
          let row = rows.find(matches);
          if (call.operation === "insert") {
            row = { id: "99999999-9999-4999-8999-999999999999", ...call.payload };
            rows.push(row);
          }
          if (call.operation === "update" && row) Object.assign(row, call.payload);
          if (call.operation === "delete" && row) rows.splice(rows.indexOf(row), 1);
          return { data: row ? { ...row } : null, error: null };
        },
        then(resolve) { return resolve({ data: rows.filter(matches).sort((a, b) => a.sort_order - b.sort_order), error: null }); },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      if (name !== "insert_profile_content_block") return { data: null, error: { message: "unexpected" } };
      rows.push({ id: imageId, profile_id: args.p_profile_id, type: "image_grid", slot: null,
        sort_order: 1, content: {}, config: { columns: 1, width_percent: 100,
          offset_percent: 0, aspect_ratio: 1.5, spacing_top: "normal", spacing_bottom: "normal" } });
      return { data: imageId, error: null };
    },
  };
}

test("admin adds a scoped image next to text, then switches side and 25/75 ratio", async () => {
  const db = client();
  const created = await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-image", text_block_id: textId, image_side: "right", image_width: "25",
    profile_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  }));
  assert.equal(created.blockId, imageId);
  assert.equal(db.rows.find((row) => row.id === textId).config.width_percent, 100,
    "the public text layout remains unchanged until the image upload succeeds");
  assert.deepEqual(db.rows.find((row) => row.id === aboutId).content.order,
    ["section:about", textId, imageId, "section:business"]);
  assert.ok(db.calls.find((call) => call.rpc === "insert_profile_content_block")?.args.p_profile_id === profileId);
  const right = await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-layout", text_block_id: textId, image_block_id: imageId,
    image_side: "right", image_width: "25",
  }));
  assert.ok(right.success);
  assert.equal(db.rows.find((row) => row.id === textId).config.width_percent, 75);
  assert.equal(db.rows.find((row) => row.id === imageId).config.offset_percent, 75);
  assert.deepEqual(db.rows.find((row) => row.id === aboutId).content.order,
    ["section:about", textId, imageId, "section:business"]);
  const changed = await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-layout", text_block_id: textId, image_block_id: imageId,
    image_side: "left", image_width: "75",
  }));
  assert.ok(changed.success);
  assert.equal(db.rows.find((row) => row.id === imageId).config.width_percent, 75);
  assert.equal(db.rows.find((row) => row.id === textId).config.offset_percent, 75);
  assert.deepEqual(db.rows.find((row) => row.id === aboutId).content.order,
    ["section:about", imageId, textId, "section:business"]);
  assert.equal(db.rows.find((row) => row.id === otherId).config.width_percent, 100);
});

test("foreign blocks, invalid ratios and non-admins cannot add or rearrange images", async () => {
  for (const values of [
    { intent: "pair-image", text_block_id: otherId, image_side: "right", image_width: "50" },
    { intent: "pair-image", text_block_id: textId, image_side: "right", image_width: "30" },
    { intent: "pair-layout", text_block_id: textId, image_block_id: otherId, image_side: "left", image_width: "50" },
  ]) {
    const db = client();
    assert.ok((await changeAdminProfileContent(db, profileId, slug, form(values))).error);
    assert.ok(!db.calls.some((call) => call.rpc || call.operation === "update"));
  }
  const denied = client({ admin: false });
  assert.notEqual((await changeAdminProfileContent(denied, profileId, slug, form({
    intent: "pair-image", text_block_id: textId, image_side: "right", image_width: "50",
  }))).access, "admin");
  assert.ok(!denied.calls.some((call) => call.rpc || call.operation === "update"));
});
