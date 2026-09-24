import test from "node:test";
import assert from "node:assert/strict";
import "./helpers/load-ts.mjs";
const layout = await import("../src/lib/content-block-layout.ts");

test("legacy content and image blocks receive harmless public defaults", () => {
  assert.deepEqual(layout.normalizeTextBlockLayout({}), {
    width_percent: 100, offset_percent: 0, text_align: "left",
    spacing_top: "normal", spacing_bottom: "normal",
  });
  assert.deepEqual(layout.normalizeBlockLayout({ width_percent: 40, offset_percent: 100 }), {
    width_percent: 40, offset_percent: 60, spacing_top: "normal", spacing_bottom: "normal",
  });
  assert.equal(layout.hasPersistedBlockLayout({}), false);
});

test("preset offsets exactly center or right-align all supported widths", () => {
  for (const [width, center, right] of [[25, 37.5, 75], [40, 30, 60], [50, 25, 50], [70, 15, 30], [75, 12.5, 25], [100, 0, 0]]) {
    assert.equal(layout.blockPositionOffset(width, "left"), 0);
    assert.equal(layout.blockPositionOffset(width, "center"), center);
    assert.equal(layout.blockPositionOffset(width, "right"), right);
  }
});

test("horizontal drag clamps inside canvas and snaps to left, center and right", () => {
  assert.deepEqual(layout.dragBlockOffset(20, 40, -10000, 1000), { offset: 0, snap: "left" });
  assert.deepEqual(layout.dragBlockOffset(20, 40, 10000, 1000), { offset: 60, snap: "right" });
  assert.deepEqual(layout.dragBlockOffset(20, 40, 95, 1000), { offset: 30, snap: "center" });
  assert.deepEqual(layout.dragBlockOffset(0, 75, 124, 1000), { offset: 12.5, snap: "center" });
  assert.equal(layout.dragBlockOffset(0, 40, 120, 1000).offset, 12);
});

test("alignment, spacing and offset validators reject unknown or fractional out-of-range values", () => {
  for (const value of ["left", "center", "right"]) assert.equal(layout.validTextAlignment(value), true);
  assert.equal(layout.validTextAlignment("justify"), false);
  for (const value of ["small", "normal", "large"]) assert.equal(layout.validSpacing(value), true);
  assert.equal(layout.validSpacing("huge"), false);
  assert.equal(layout.validWidth(25), true);
  assert.equal(layout.validWidth(24), false);
  assert.equal(layout.validWidth(101), false);
  assert.equal(layout.validOffset(12.5), true);
  assert.equal(layout.validOffset(12.55), false);
  assert.equal(layout.validOffset(-1), false);
});
