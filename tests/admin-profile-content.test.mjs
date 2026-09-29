import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { changeAdminProfileContent } = await import("../src/lib/admin-profile-content.ts");
const { splitProfileContent } = await import("../src/lib/profile-content.ts");

const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignProfile = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const slug = "sichtbares-profil";
const first = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const second = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const foreignBlock = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

test("paired About keeps its inner ratio while general width and position change on the shared wrapper", async () => {
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading",
    sort_order: 0, content: { text: "Über Sichtbares Profil", adjacent_image_id: second,
      layout: { width_percent: 75, offset_percent: 25, text_align: "left" },
      pair_layouts: { "section:about": { width_percent: 100, offset_percent: 0 } } } };
  const image = { id: second, profile_id: profileId, type: "image_grid", slot: null,
    sort_order: 1, content: { text: "" }, config: { columns: 1, width_percent: 25, offset_percent: 0 } };
  const db = client({ blocks: [about, image] });
  const result = await changeAdminProfileContent(db, profileId, slug, form({
    intent: "section-pair-frame", block_id: "section:about", width_percent: "50",
    offset_percent: "25", text_align: "center",
  }));
  assert.ok(result.success);
  assert.equal(about.content.layout.width_percent, 75);
  assert.equal(about.content.layout.offset_percent, 25);
  assert.equal(about.content.pair_layouts["section:about"].width_percent, 50);
  assert.equal(about.content.pair_layouts["section:about"].offset_percent, 25);
  assert.ok((await changeAdminProfileContent(client({ admin: false, blocks: [about, image] }),
    profileId, slug, form({ intent: "section-pair-frame", block_id: "section:about", width_percent: "25" }))).access !== "admin");
});

test("About creates a scoped pending image before the existing upload flow can pair it", async () => {
  const imageId = "77777777-7777-4777-8777-777777777777";
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading",
    sort_order: 0, content: { text: "Über Sichtbares Profil", order: ["section:about", "section:business"],
      layout: { width_percent: 100, offset_percent: 0 } } };
  const blocks = [about];
  const db = client({ blocks });
  db.rpc = async (name, args) => {
    db.calls.push({ rpc: name, args });
    if (name === "insert_profile_content_block") {
      blocks.push({ id: imageId, profile_id: profileId, type: "image_grid", slot: null,
        sort_order: 0, content: { text: "" }, config: { columns: 1, width_percent: 100,
          offset_percent: 0, aspect_ratio: 1.5 } });
      return { data: imageId, error: null };
    }
    return { data: null, error: null };
  };
  const created = await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-image", text_block_id: "section:about", image_side: "right", image_width: "25",
  }));
  assert.equal(created.blockId, imageId);
  assert.equal(about.content.pending_image_id, imageId);
  assert.equal(about.content.adjacent_image_id, undefined);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-layout", text_block_id: "section:about", image_block_id: second,
    image_side: "right", image_width: "25",
  }))).error);
  const paired = await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-layout", text_block_id: "section:about", image_block_id: imageId,
    image_side: "right", image_width: "25",
  }));
  assert.ok(paired.success);
  assert.equal(about.content.pending_image_id, undefined);
  assert.equal(about.content.adjacent_image_id, imageId);
  assert.equal(about.content.layout.width_percent, 75);
  assert.equal(about.content.pair_layouts["section:about"].width_percent, 100);
});

test("business areas use the same scoped image pairing without changing structured profile data", async () => {
  const imageId = "77777777-7777-4777-8777-777777777777";
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading",
    sort_order: 0, content: { text: "Über Sichtbares Profil", order: ["section:about", "section:business"] } };
  const business = { id: second, profile_id: profileId, type: "heading", slot: "business_areas_heading",
    sort_order: 0, content: { text: "Tätigkeitsbereiche", layout: { width_percent: 100, offset_percent: 0 } } };
  const blocks = [about, business];
  const db = client({ blocks });
  db.rpc = async (name, args) => {
    db.calls.push({ rpc: name, args });
    if (name === "insert_profile_content_block") {
      blocks.push({ id: imageId, profile_id: profileId, type: "image_grid", slot: null,
        sort_order: 0, content: { text: "" }, config: { columns: 1, width_percent: 100,
          offset_percent: 0, aspect_ratio: 1.5 } });
      return { data: imageId, error: null };
    }
    return { data: null, error: null };
  };
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-image", text_block_id: "section:business", image_side: "left", image_width: "50",
  }))).success);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({
    intent: "pair-layout", text_block_id: "section:business", image_block_id: imageId,
    image_side: "left", image_width: "50",
  }))).success);
  assert.equal(business.content.adjacent_image_id, imageId);
  assert.equal(business.content.layout.offset_percent, 50);
  assert.equal(about.content.pair_layouts["section:business"].width_percent, 100);
  assert.ok(db.calls.every((call) => call.table !== "company_profiles" || !call.operation));
});

test("duplicating a field-backed text-image section reuses the image-copy RPC and preserves its frame", async () => {
  const imageId = "77777777-7777-4777-8777-777777777777";
  const ids = ["88888888-8888-4888-8888-888888888888",
    "99999999-9999-4999-8999-999999999999", "66666666-6666-4666-8666-666666666666"];
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading",
    sort_order: 0, content: { text: "Über Sichtbares Profil",
      order: ["section:about", "section:business", imageId],
      pair_layouts: { "section:business": { width_percent: 75, offset_percent: 25 } } } };
  const business = { id: second, profile_id: profileId, type: "heading", slot: "business_areas_heading",
    sort_order: 0, content: { text: "Tätigkeitsbereiche", adjacent_image_id: imageId,
      layout: { width_percent: 75, offset_percent: 0 } } };
  const image = { id: imageId, profile_id: profileId, type: "image_grid", slot: null,
    sort_order: 1, content: { text: "" }, config: { columns: 1, width_percent: 25, offset_percent: 75 } };
  const blocks = [about, business, image];
  const db = client({ blocks });
  db.rpc = async (name, args) => {
    db.calls.push({ rpc: name, args });
    const id = ids.shift();
    if (name === "insert_profile_content_block") blocks.push({ id, profile_id: profileId,
      type: args.p_type, slot: null, sort_order: blocks.length, content: { text: args.p_text }, config: {} });
    if (name === "duplicate_profile_content_block") blocks.push({ ...image, id, sort_order: blocks.length });
    return { data: id, error: null };
  };
  const result = await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-duplicate", block_id: "section:business" }));
  assert.ok(result.success);
  assert.ok(db.calls.some((call) => call.rpc === "duplicate_profile_content_block" &&
    call.args.p_profile_id === profileId && call.args.p_block_id === imageId));
  assert.equal(about.content.pair_layouts["99999999-9999-4999-8999-999999999999"].width_percent, 75);
  assert.deepEqual(about.content.order.slice(1, 5), ["section:business",
    "88888888-8888-4888-8888-888888888888", "99999999-9999-4999-8999-999999999999",
    "66666666-6666-4666-8666-666666666666"]);
});

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
  const profile = { id: profileId, display_name: "Sichtbares Profil", description: "Beschreibung", business_areas: "Bereiche" };
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "editor" } : null }, error: null }) },
    storage: { from: () => ({ list: async () => ({ data: [], error: null }),
      remove: async () => ({ data: [], error: null }) }) },
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
              (call.operation === "update" || call.columns === "display_name" ||
                call.columns === "description,business_areas" || call.filters.some(([key, value]) => key === "slug" && value === slug));
            if (valid && call.operation === "update") Object.assign(profile, call.payload);
            return { data: valid ? { ...profile } : null, error: null };
          }
          const selected = blocks.find((block) => call.filters.every(([key, value]) => block[key] === value));
          if (call.operation === "insert") {
            if (call.payload.slot) {
              const inserted = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", ...call.payload };
              blocks.push(inserted);
              return { data: inserted, error: null };
            }
            return { data: { id: first }, error: null };
          }
          if (call.operation === "update" && selected?.slot) Object.assign(selected, call.payload);
          if (call.operation === "delete" && selected) blocks.splice(blocks.indexOf(selected), 1);
          if (call.operation) return { data: selected ? { id: selected.id } : null, error: null };
          return { data: selected ?? null, error: null };
        },
        then(resolve) {
          const selected = blocks.filter((block) => call.filters.every(([key, value]) => block[key] === value));
          if (call.operation === "update") selected.forEach((block) => Object.assign(block, call.payload));
          if (call.operation === "delete") selected.forEach((block) => blocks.splice(blocks.indexOf(block), 1));
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

test("heading and body of a field-backed section align and delete independently within the displayed profile", async () => {
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading",
    sort_order: 0, content: { text: "Über das Haus", adjacent_image_id: second,
      layout: { width_percent: 75, offset_percent: 0 } } };
  const image = { id: second, profile_id: profileId, type: "image_grid", slot: null,
    sort_order: 1, content: { text: "" }, config: { columns: 1 } };
  const db = client({ blocks: [about, image] });
  const action = (part, operation, extra = {}) => changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-part", block_id: "section:about", part, action: operation, ...extra }));
  assert.ok((await action("heading", "align", { text_align: "center", profile_id: foreignProfile })).success);
  assert.ok((await action("text", "align", { text_align: "right" })).success);
  assert.equal(about.content.heading_align, "center");
  assert.equal(about.content.body_align, "right");
  assert.equal(about.content.adjacent_image_id, second);
  assert.ok((await action("heading", "delete")).success);
  assert.equal(about.content.heading_hidden, true);
  assert.ok(!db.calls.some((call) => call.table === "company_profiles" && call.operation));
  assert.ok((await action("heading", "restore")).success);
  assert.equal(about.content.heading_hidden, false);
  assert.ok((await action("text", "delete")).success);
  const profileWrite = db.calls.find((call) => call.table === "company_profiles" && call.operation === "update");
  assert.deepEqual(profileWrite.payload, { description: null });
  assert.deepEqual(profileWrite.filters, [["id", profileId]]);
  assert.equal(about.content.adjacent_image_id, second);
  assert.ok((await action("text", "align", { text_align: "invalid" })).error);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "section-part",
    block_id: foreignBlock, part: "heading", action: "delete" }))).error);
  assert.ok((await changeAdminProfileContent(client({ admin: false, blocks: [about] }), profileId, slug,
    form({ intent: "section-part", block_id: "section:about", part: "heading", action: "delete" }))).access !== "admin");
});

test("deleting business-area body preserves its heading and only clears the structured field", async () => {
  const business = { id: second, profile_id: profileId, type: "heading", slot: "business_areas_heading",
    sort_order: 0, content: { text: "Tätigkeitsbereiche" } };
  const db = client({ blocks: [business] });
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "section-part",
    block_id: "section:business", part: "text", action: "delete" }))).success);
  assert.equal(business.content.text, "Tätigkeitsbereiche");
  assert.deepEqual(db.calls.find((call) => call.table === "company_profiles" && call.operation)?.payload,
    { business_areas: null });
});

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

test("heading overrides keep fixed slots and moves save a unified same-profile order", async () => {
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
  assert.deepEqual(db.calls.find((call) => call.operation === "update" && call.payload?.content?.order)?.payload.content.order,
    ["section:about", second, first, "section:business"]);
});

test("history reorder accepts only the complete displayed block permutation", async () => {
  const order = (ids) => {
    const data = form({ intent: "reorder", profile_id: foreignProfile });
    ids.forEach((id) => data.append("block_ids", id));
    return data;
  };
  const db = client();
  assert.ok((await changeAdminProfileContent(db, profileId, slug, order([second, first]))).success);
  assert.deepEqual(db.calls.find((call) => call.operation === "update" && call.payload?.content?.order)?.payload.content.order,
    ["section:about", second, first, "section:business"]);
  for (const ids of [[first], [first, first], [first, foreignBlock]]) {
    const denied = client();
    assert.ok((await changeAdminProfileContent(denied, profileId, slug, order(ids))).error);
    assert.ok(!denied.calls.some((call) => call.rpc === "reorder_profile_content_blocks"));
  }
  for (const [id, targetSlug, options] of [[foreignProfile, slug, {}], [profileId, "fremd", {}], [profileId, slug, { admin: false }]]) {
    const denied = client(options);
    assert.notEqual((await changeAdminProfileContent(denied, id, targetSlug, order([second, first]))).success, "Die Reihenfolge wurde gespeichert.");
    assert.ok(!denied.calls.some((call) => call.rpc === "reorder_profile_content_blocks"));
  }
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

test("field-backed editorial sections keep their heading, layout and visibility in existing slot content", async () => {
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading", sort_order: 0,
    content: { text: "Über das Haus", hidden: false, order: ["section:about", "section:business"] }, config: {} };
  const db = client({ blocks: [about] });
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "layout", block_id: "section:about",
    width_percent: "50", offset_percent: "50", text_align: "right" }))).success);
  assert.deepEqual(about.content.layout, { width_percent: 50, offset_percent: 50, text_align: "right",
    spacing_top: "normal", spacing_bottom: "normal" });
  assert.deepEqual(about.config, {});
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "section-toggle", block_id: "section:about" }))).success);
  assert.equal(about.content.hidden, true);
  assert.deepEqual(about.content.order, ["section:about", "section:business"]);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "heading", slot: "about_heading", text: "Neu" }))).success);
  assert.equal(about.content.text, "Neu");
  assert.equal(about.content.hidden, true);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "heading", slot: "about_heading", text: "" }))).success);
  assert.equal(about.content.text, "Über Sichtbares Profil");
  assert.equal(about.content.hidden, true);
  assert.equal(about.content.layout.width_percent, 50);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "section-toggle", block_id: "section:foreign" }))).error);
  assert.ok(db.calls.every((call) => !call.payload?.description && !call.payload?.business_areas));
});

test("a section can move across free blocks without changing their data or another profile", async () => {
  const db = client();
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "move", block_id: "section:about", direction: "down" }))).success);
  const orderWrite = db.calls.find((call) => call.operation === "update" && call.payload?.content?.order);
  assert.deepEqual(orderWrite.payload.content.order, [first, "section:about", second, "section:business"]);
  assert.ok(orderWrite.filters.some(([key, value]) => key === "profile_id" && value === profileId));
  assert.ok((await changeAdminProfileContent(client({ admin: false }), profileId, slug,
    form({ intent: "move", block_id: "section:about", direction: "down" }))).access !== "admin");
});

test("free text and image blocks retain content when hidden and return on show", async () => {
  const about = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", profile_id: profileId,
    type: "heading", slot: "about_heading", sort_order: 0, content: { text: "Über das Haus" } };
  const blocks = [about,
    { id: first, profile_id: profileId, type: "text", slot: null, sort_order: 0, content: { text: "Sichtbar" } },
    { id: second, profile_id: profileId, type: "image_grid", slot: null, sort_order: 1,
      content: {}, config: { columns: 1, width_percent: 100, offset_percent: 0 } }];
  const db = client({ blocks });
  for (const id of [first, second]) assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "block-toggle", block_id: id }))).success);
  assert.deepEqual(new Set(about.content.hidden_blocks), new Set([first, second]));
  assert.equal(blocks.find((block) => block.id === first).content.text, "Sichtbar");
  assert.equal(splitProfileContent(blocks, "Haus").items.find((item) => item.key === first).hidden, true);
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "block-toggle", block_id: first }))).success);
  assert.equal(splitProfileContent(blocks, "Haus").items.find((item) => item.key === first).hidden, false);
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "block-toggle", block_id: foreignBlock }))).error);
});

test("deleting a field-backed section clears only its profile field and removes it from saved order", async () => {
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading", sort_order: 0,
    content: { text: "Über das Haus", order: ["section:about", second, "section:business"] } };
  const text = { id: second, profile_id: profileId, type: "text", slot: null, sort_order: 0,
    content: { text: "Anderer Inhalt" } };
  const db = client({ blocks: [about, text] });
  const deleted = await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-delete", block_id: "section:about", profile_id: foreignProfile }));
  assert.ok(deleted.success);
  const clear = db.calls.find((call) => call.table === "company_profiles" && call.operation === "update");
  assert.deepEqual(clear.payload, { description: null });
  assert.ok(clear.filters.some(([key, value]) => key === "id" && value === profileId));
  assert.deepEqual(about.content.order, [second, "section:business"]);
  assert.ok(!splitProfileContent([about, text], "Haus").items.some((item) => item.key === "section:about"));
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-restore", block_id: "section:about" }))).success);
  assert.ok(splitProfileContent([about, text], "Haus").items.some((item) => item.key === "section:about"));
  assert.ok((await changeAdminProfileContent(client({ admin: false }), profileId, slug,
    form({ intent: "section-delete", block_id: "section:business" }))).access !== "admin");
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-delete", block_id: "section:foreign" }))).error);
});

test("paired text and image share a scoped frame and move together", async () => {
  const about = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", profile_id: profileId,
    type: "heading", slot: "about_heading", sort_order: 0,
    content: { text: "Über das Haus", order: ["section:about", first, second, "section:business"] } };
  const text = { id: first, profile_id: profileId, type: "text", slot: null, sort_order: 0,
    content: { text: "Text" }, config: { width_percent: 75, offset_percent: 0 } };
  const image = { id: second, profile_id: profileId, type: "image_grid", slot: null, sort_order: 1,
    content: {}, config: { columns: 1, width_percent: 25, offset_percent: 75 } };
  const blocks = [about, text, image];
  const db = client({ blocks });
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "pair-frame",
    text_block_id: first, image_block_id: second, width_percent: "50", offset_percent: "25", text_align: "center" }))).success);
  assert.equal(about.content.pair_layouts[first].width_percent, 50);
  assert.equal(splitProfileContent([about, text, image], "Haus").blocks.find((block) => block.id === first).pair_layout.offset_percent, 25);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "pair-move",
    text_block_id: first, image_block_id: second, direction: "down" }))).success);
  assert.deepEqual(about.content.order, ["section:about", "section:business", first, second]);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "pair-toggle",
    text_block_id: first, image_block_id: second }))).success);
  assert.deepEqual(new Set(about.content.hidden_blocks), new Set([first, second]));
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "pair-frame",
    text_block_id: first, image_block_id: foreignBlock, width_percent: "50" }))).error);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "pair-delete",
    text_block_id: first, image_block_id: foreignBlock }))).error);
  assert.ok((await changeAdminProfileContent(db, profileId, slug, form({ intent: "pair-delete",
    text_block_id: first, image_block_id: second }))).success);
  assert.ok(!blocks.some((block) => block.id === first || block.id === second));
  assert.deepEqual(about.content.order, ["section:about", "section:business"]);
});

test("deleting a free block removes its row and stale order metadata while preserving neighbors", async () => {
  const about = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", profile_id: profileId,
    type: "heading", slot: "about_heading", sort_order: 0,
    content: { text: "Über das Haus", order: ["section:about", first, second, "section:business"],
      hidden_blocks: [second] } };
  const blocks = [about,
    { id: first, profile_id: profileId, type: "heading", slot: null, sort_order: 0, content: { text: "Bleibt" } },
    { id: second, profile_id: profileId, type: "text", slot: null, sort_order: 1, content: { text: "Wird gelöscht" } }];
  const db = client({ blocks });
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "delete", block_id: second }))).success);
  assert.ok(!blocks.some((block) => block.id === second));
  assert.deepEqual(about.content.order, ["section:about", first, "section:business"]);
  assert.deepEqual(about.content.hidden_blocks, []);
  assert.deepEqual(splitProfileContent(blocks, "Haus").items.map((item) => item.key),
    ["section:about", first, "section:business"]);
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "delete", block_id: second }))).error);
});

test("business areas can be hidden, duplicated, deleted and restored without clearing other fields", async () => {
  const about = { id: first, profile_id: profileId, type: "heading", slot: "about_heading", sort_order: 0,
    content: { text: "Über das Haus", order: ["section:about", "section:business"] } };
  const business = { id: second, profile_id: profileId, type: "heading", slot: "business_areas_heading", sort_order: 0,
    content: { text: "Tätigkeitsbereiche" } };
  const blocks = [about, business];
  const db = client({ blocks });
  let inserted = 0;
  db.rpc = async (name, args) => {
    db.calls.push({ rpc: name, args });
    const id = inserted++ ? "99999999-9999-4999-8999-999999999999" : "88888888-8888-4888-8888-888888888888";
    blocks.push({ id, profile_id: profileId, type: args.p_type, slot: null, sort_order: inserted,
      content: { text: args.p_text }, config: {} });
    return { data: id, error: null };
  };
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-toggle", block_id: "section:business" }))).success);
  assert.equal(business.content.hidden, true);
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-toggle", block_id: "section:business" }))).success);
  assert.equal(business.content.hidden, false);
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-duplicate", block_id: "section:business" }))).success);
  assert.ok(db.calls.some((call) => call.rpc === "insert_profile_content_block" && call.args.p_type === "heading"));
  assert.ok(db.calls.some((call) => call.rpc === "insert_profile_content_block" && call.args.p_type === "text"));
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-delete", block_id: "section:business" }))).success);
  const fieldWrite = db.calls.find((call) => call.table === "company_profiles" && call.operation === "update");
  assert.deepEqual(fieldWrite.payload, { business_areas: null });
  assert.ok(!blocks.some((block) => block.slot === "business_areas_heading"));
  assert.ok(!splitProfileContent(blocks, "Haus").items.some((item) => item.kind === "business"));
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "section-restore", block_id: "section:business" }))).success);
  assert.ok(splitProfileContent(blocks, "Haus").items.some((item) => item.kind === "business"));
});

test("duplicating a text-image pair preserves its frame and delegates shared image rows to the scoped RPC", async () => {
  const about = { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", profile_id: profileId,
    type: "heading", slot: "about_heading", sort_order: 0,
    content: { text: "Über das Haus", order: ["section:about", first, second, "section:business"],
      pair_layouts: { [first]: { width_percent: 50, offset_percent: 25, text_align: "center" } } } };
  const blocks = [about,
    { id: first, profile_id: profileId, type: "text", slot: null, sort_order: 0,
      content: { text: "Text" }, config: { width_percent: 75, offset_percent: 0 } },
    { id: second, profile_id: profileId, type: "image_grid", slot: null, sort_order: 1,
      content: {}, config: { columns: 1, width_percent: 25, offset_percent: 75 } }];
  const db = client({ blocks });
  const copies = ["88888888-8888-4888-8888-888888888888", "99999999-9999-4999-8999-999999999999"];
  db.rpc = async (name, args) => {
    db.calls.push({ rpc: name, args });
    const source = blocks.find((block) => block.id === args.p_block_id);
    const id = copies.shift();
    blocks.push({ ...source, id, sort_order: blocks.length, content: source.type === "image_grid" ? {} : { ...source.content } });
    return { data: id, error: null };
  };
  assert.ok((await changeAdminProfileContent(db, profileId, slug,
    form({ intent: "pair-duplicate", text_block_id: first, image_block_id: second }))).success);
  const textCopy = "88888888-8888-4888-8888-888888888888";
  assert.deepEqual(about.content.pair_layouts[textCopy], about.content.pair_layouts[first]);
  assert.deepEqual(about.content.order, ["section:about", first, second, textCopy,
    "99999999-9999-4999-8999-999999999999", "section:business"]);
  assert.ok(db.calls.some((call) => call.rpc === "duplicate_profile_content_block" &&
    call.args.p_block_id === second && call.args.p_profile_id === profileId));
  assert.ok(db.calls.every((call) => !call.operation || call.table !== "company_profiles"));
});
