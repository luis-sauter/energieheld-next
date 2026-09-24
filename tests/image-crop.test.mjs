import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const crop = await import("../src/lib/image-crop.ts");

test("legacy images default to centered focus and unscaled cover rendering", () => {
  assert.deepEqual(crop.normalizeImageCrop({}), { focus_x: 50, focus_y: 50, zoom: 1 });
  assert.deepEqual(crop.imageCropStyle({}), {
    objectFit: "cover", objectPosition: "50% 50%", transform: "scale(1)", transformOrigin: "50% 50%",
  });
  assert.equal(crop.hasPersistedImageCrop({}), false);
});

test("public and editor styling applies the same saved focus and zoom", () => {
  const saved = { focus_x: 20, focus_y: 70, zoom: 1.8 };
  assert.deepEqual(crop.imageCropStyle(saved), {
    objectFit: "cover", objectPosition: "20% 70%", transform: "scale(1.8)", transformOrigin: "20% 70%",
  });
  assert.equal(crop.hasPersistedImageCrop(saved), true);
});

test("server input accepts exact bounds and rejects malformed or excessive precision", () => {
  assert.deepEqual(crop.parseImageCrop("0", "100", "3"), { focus_x: 0, focus_y: 100, zoom: 3 });
  assert.deepEqual(crop.parseImageCrop("37.5", "62.5", "1.25"), { focus_x: 37.5, focus_y: 62.5, zoom: 1.25 });
  for (const values of [["-1", "50", "1"], ["101", "50", "1"], ["50", "-1", "1"],
    ["50", "101", "1"], ["50", "50", "0.99"], ["50", "50", "3.01"],
    ["12.34", "50", "1"], ["50", "50", "1.234"], ["Infinity", "50", "1"]])
    assert.equal(crop.parseImageCrop(...values), null);
});

test("drag moves the picture in the pointer direction and clamps focus", () => {
  const start = { focus_x: 50, focus_y: 50, zoom: 1.5 };
  assert.ok(crop.panImageCrop(start, 40, 0, 400, 200).focus_x < 50);
  assert.ok(crop.panImageCrop(start, 0, -40, 400, 200).focus_y > 50);
  assert.deepEqual(crop.panImageCrop(start, 10000, -10000, 400, 200),
    { focus_x: 0, focus_y: 100, zoom: 1.5 });
  assert.deepEqual(crop.panImageCrop(start, 10, 10, 0, 0), start);
});

test("zoom buttons clamp to one through three while center and reset have separate semantics", () => {
  const saved = { focus_x: 20, focus_y: 70, zoom: 1.7 };
  assert.deepEqual(crop.centerImageCrop(saved), { focus_x: 50, focus_y: 50, zoom: 1.7 });
  assert.deepEqual(crop.DEFAULT_IMAGE_CROP, { focus_x: 50, focus_y: 50, zoom: 1 });
  assert.equal(crop.nudgeImageCrop(saved, "left").focus_x, 25);
  assert.equal(crop.nudgeImageCrop(saved, "right").focus_x, 15);
  assert.equal(crop.nudgeImageCrop(saved, "up").focus_y, 75);
  assert.equal(crop.nudgeImageCrop(saved, "down").focus_y, 65);
  assert.equal(crop.zoomImageCrop(saved, 0.1).zoom, 1.8);
  assert.equal(crop.zoomImageCrop(saved, -0.1).zoom, 1.6);
  assert.equal(crop.zoomImageCrop(saved, -10).zoom, 1);
  assert.equal(crop.zoomImageCrop(saved, 10).zoom, 3);
});
