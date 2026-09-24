import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const { loadPublicProfileContent, splitProfileContent } = await import("../src/lib/profile-content.ts");

const profile = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const block = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const image = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const path = `profiles/${profile}/blocks/${block}/${image}.jpg`;
function client({ newTable = true, withImage = true } = {}) {
  const content = [
    { id: "heading", profile_id: profile, type: "heading", slot: null, sort_order: 0, content: { text: "Willkommen" }, config: {} },
    { id: "text", profile_id: profile, type: "text", slot: null, sort_order: 1, content: { text: "Bestehender Inhalt" }, config: {} },
    ...(withImage ? [{ id: block, profile_id: profile, type: "image_grid", slot: null, sort_order: 2, content: {}, config: { columns: 1 } }] : []),
  ];
  return {
    from(table) {
      return {
        select() { return this; }, eq() { return this; }, in() { return this; },
        order() { return this; }, limit() { return this; },
        then(resolve) { return resolve(table === "profile_content_blocks"
          ? { data: content, error: null }
          : newTable ? { data: [{ id: image, block_id: block, storage_path: path, alt_text: "Blick aufs Haus", sort_order: 0 }], error: null }
            : { data: null, error: { code: "42P01" } }); },
      };
    },
    storage: { from() { return { createSignedUrls: async () => ({ data: [{ path, signedUrl: "https://signed.invalid/image" }], error: null }) }; } },
  };
}

test("public loader attaches signed image URLs to image grids without exposing raw files", async () => {
  const result = await loadPublicProfileContent(client(), profile);
  assert.equal(result.available, true);
  assert.equal(result.imagesAvailable, true);
  const grid = splitProfileContent(result.blocks, "Firma").blocks.find((item) => item.type === "image_grid");
  assert.equal(grid.images[0].src, "https://signed.invalid/image");
  assert.equal(grid.images[0].alt_text, "Blick aufs Haus");
  assert.equal("storage_path" in grid.images[0], false);
  assert.deepEqual(result.blocks.slice(0, 2).map((item) => item.content.text), ["Willkommen", "Bestehender Inhalt"]);
});

test("a missing image migration leaves existing heading and text blocks available", async () => {
  const result = await loadPublicProfileContent(client({ newTable: false, withImage: false }), profile);
  assert.equal(result.available, true);
  assert.equal(result.imagesAvailable, false);
  assert.deepEqual(splitProfileContent(result.blocks, "Firma").blocks.map((item) => item.content.text), ["Willkommen", "Bestehender Inhalt"]);
});
