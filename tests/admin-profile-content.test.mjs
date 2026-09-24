import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { changeAdminProfileContent } = await import("../src/lib/admin-profile-content.ts");

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignProfile = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const slug = "sichtbares-profil";
const first = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const second = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const foreignBlock = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
function client({ authenticated = true, admin = true, blocks = [
  { id: first, profile_id: profileId, type: "heading", slot: null, sort_order: 0, content: { text: "Erste Überschrift" } },
  { id: second, profile_id: profileId, type: "text", slot: null, sort_order: 1, content: { text: "Zweiter Text" } },
  { id: foreignBlock, profile_id: foreignProfile, type: "heading", slot: null, sort_order: 0, content: { text: "Fremd" } },
] } = {}) {
  const calls = [];
  return {
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
        insert(payload) { call.operation = "insert"; call.payload = payload; return this; },
        update(payload) { call.operation = "update"; call.payload = payload; return this; },
        delete() { call.operation = "delete"; return this; },
        async maybeSingle() {
          if (table === "portal_admins") return { data: admin ? { user_id: "editor" } : null, error: null };
          if (table === "company_profiles") {
            const valid = call.filters.some(([key, value]) => key === "id" && value === profileId) &&
              call.filters.some(([key, value]) => key === "slug" && value === slug);
            return { data: valid ? { id: profileId } : null, error: null };
          }
          const selected = blocks.find((block) => call.filters.every(([key, value]) => block[key] === value));
          if (call.operation === "insert") return { data: { id: first }, error: null };
          if (call.operation) return { data: selected ? { id: selected.id } : null, error: null };
          return { data: selected ?? null, error: null };
        },
        then(resolve) {
          const selected = blocks.filter((block) => call.filters.every(([key, value]) => block[key] === value));
          return resolve({ data: selected.sort((a, b) => a.sort_order - b.sort_order), error: null });
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      if (name === "insert_profile_content_block" && args.p_before_block_id &&
        !blocks.some((block) => block.id === args.p_before_block_id && block.profile_id === args.p_profile_id))
        return { data: null, error: { message: "foreign block" } };
      return name === "insert_profile_content_block" || name === "duplicate_profile_content_block"
        ? { data: first, error: null } : { data: null, error: null };
    },
  };
}

test("signed-out and non-admin callers cannot read or mutate editorial blocks", async () => {
  for (const options of [{ authenticated: false }, { admin: false }]) {
    const db = client(options);
    const result = await changeAdminProfileContent(db, profileId, slug, form({ intent: "insert", type: "heading", text: "Neu" }));
    assert.notEqual(result.access, "admin");
    assert.ok(db.calls.every((call) => call.table === "portal_admins"));
  }
});

test("layout updates only the displayed free block and preserves image shape and content", async () => {
  const config = { columns: 3, width_percent: 75, offset_percent: 12.5,
    aspect_ratio: 1.25, spacing_top: "small", spacing_bottom: "large" };
  const blocks = [
    { id: first, profile_id: profileId, type: "image_grid", slot: null, config, content: {} },
    { id: foreignBlock, profile_id: foreignProfile, type: "text", slot: null,
      config: { width_percent: 100, offset_percent: 0, text_align: "left", spacing_top: "normal", spacing_bottom: "normal" },
      content: { text: "Fremd" } },
  ];
  const db = client({ blocks });
  const result = await changeAdminProfileContent(db, profileId, slug, form({
    intent: "layout", block_id: first, width_percent: "50", offset_percent: "25",
    profile_id: foreignProfile, columns: "4", aspect_ratio: "3", text: "Manipuliert",
  }));
  assert.ok(result.success);
  const write = db.calls.find((call) => call.operation === "update");
  assert.deepEqual(write.payload, { config: { ...config, width_percent: 50, offset_percent: 25 } });
  assert.ok(write.filters.some(([key, value]) => key === "profile_id" && value === profileId));
  assert.ok(!db.calls.some((call) => call.operation === "update" && call.payload?.content));
  for (const values of [
    { width_percent: "24" }, { width_percent: "101" }, { offset_percent: "30" },
    { spacing_top: "huge" }, { text_align: "center" },
  ]) assert.ok((await changeAdminProfileContent(client({ blocks }), profileId, slug,
    form({ intent: "layout", block_id: first, ...values }))).error);
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "layout", block_id: foreignBlock, width_percent: "50" }))).error);
});

test("text alignment and spacing update independently; duplicate uses scoped invoker RPC", async () => {
  const original = { id: first, profile_id: profileId, type: "text", slot: null,
    config: { width_percent: 60, offset_percent: 20, text_align: "left", spacing_top: "normal", spacing_bottom: "normal" },
    content: { text: "Bestehender Text" } };
  const db = client({ blocks: [original] });
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "layout", block_id: first, text_align: "center", spacing_top: "large" }))).success);
  assert.deepEqual(db.calls.find((call) => call.operation === "update").payload.config,
    { ...original.config, text_align: "center", spacing_top: "large" });
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "duplicate", block_id: first, profile_id: foreignProfile }))).success);
  assert.deepEqual(db.calls.find((call) => call.rpc === "duplicate_profile_content_block").args,
    { p_profile_id: profileId, p_block_id: first });
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "duplicate", block_id: foreignBlock }))).error);
});

test("heading and text are inserted at a server-scoped position without trusting submitted profile ID", async () => {
  for (const type of ["heading", "text"]) {
    const db = client();
    const result = await changeAdminProfileContent(db, profileId, slug, form({
      intent: "insert", type, text: `  Neuer ${type}  `,
      before_block_id: second, profile_id: foreignProfile, slug: "fremd", sort_order: "-1000",
    }));
    assert.ok(result.success);
    assert.deepEqual(db.calls.find((call) => call.rpc)?.args, {
      p_profile_id: profileId, p_type: type, p_text: `Neuer ${type}`, p_before_block_id: second,
    });
  }
});

test("updates and deletes require the block to belong to the displayed profile", async () => {
  const db = client();
  const update = await changeAdminProfileContent(db, profileId, slug, form({ intent: "update", block_id: first, text: "  Geändert  " }));
  assert.ok(update.success);
  const write = db.calls.find((call) => call.operation === "update");
  assert.deepEqual(write.payload, { content: { text: "Geändert" } });
  assert.ok(write.filters.some(([key, value]) => key === "profile_id" && value === profileId));
  const removal = await changeAdminProfileContent(db, profileId, slug, form({ intent: "delete", block_id: second }));
  assert.ok(removal.success);
  for (const intent of ["update", "delete", "move"]) {
    const result = await changeAdminProfileContent(db, profileId, slug, form({ intent, block_id: foreignBlock, text: "Fremd", direction: "up" }));
    assert.ok(result.error);
  }
  assert.equal(db.calls.filter((call) => call.operation === "delete").length, 1);
});

test("forged target ID, slug, block ID and order never mutate another profile", async () => {
  const db = client();
  for (const [id, targetSlug] of [[foreignProfile, slug], [profileId, "fremd"]]) {
    const result = await changeAdminProfileContent(db, id, targetSlug, form({ intent: "insert", type: "heading", text: "Angriff" }));
    assert.ok(result.error);
  }
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "insert", type: "text", text: "Text", before_block_id: foreignBlock }))).error);
  // The invoker RPC validates the foreign before ID under the parent lock; the helper never issues a direct insert.
  assert.ok(db.calls.filter((call) => call.operation === "insert").length === 0);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "insert", type: "text", text: "Text", before_block_id: "bad" }))).error);
});

test("heading overrides use fixed slots and block moves submit an exact same-profile permutation", async () => {
  const db = client();
  const heading = await changeAdminProfileContent(db, profileId, slug, form({ intent: "heading", slot: "about_heading", text: "Über das Team" }));
  assert.ok(heading.success);
  assert.deepEqual(db.calls.find((call) => call.operation === "insert")?.payload, {
    profile_id: profileId, type: "heading", slot: "about_heading", sort_order: 0,
    content: { text: "Über das Team" },
  });
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "heading", slot: "foreign_slot", text: "Nein" }))).error);
  const moved = await changeAdminProfileContent(db, profileId, slug, form({ intent: "move", block_id: second, direction: "up", sort_order: "9999" }));
  assert.ok(moved.success);
  assert.deepEqual(db.calls.find((call) => call.rpc === "reorder_profile_content_blocks")?.args, {
    p_profile_id: profileId, p_block_ids: [second, first],
  });
});

test("existing heading override can be edited or cleared without touching profile description", async () => {
  const db = client({ blocks: [{
    id: first, profile_id: profileId, type: "heading", slot: "about_heading",
    sort_order: 0, content: { text: "Über das Team" },
  }] });
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "heading", slot: "about_heading", text: "Neue Überschrift" }))).success);
  const update = db.calls.find((call) => call.operation === "update");
  assert.deepEqual(update.payload, { content: { text: "Neue Überschrift" } });
  assert.ok(update.filters.some(([key, value]) => key === "profile_id" && value === profileId));
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "heading", slot: "about_heading", text: "" }))).success);
  assert.ok(db.calls.find((call) => call.operation === "delete")?.filters.some(([key, value]) => key === "slot" && value === "about_heading"));
  assert.ok(db.calls.every((call) => !call.payload?.description));
});
