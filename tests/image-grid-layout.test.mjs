import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./helpers/load-ts.mjs";
const { imageGridSlots, normalizeImageGridConfig, publicImageGridColumns,
  resizeImageGridFromPointer, parseImageGridSize } = await import("../src/lib/image-grid-layout.ts");

test("editor slots match 1–4 columns while public grids use only occupied columns", () => {
  for (const columns of [1, 2, 3, 4]) {
    assert.equal(imageGridSlots(columns, []).length, columns);
    assert.equal(imageGridSlots(columns, []).filter((slot) => slot === null).length, columns);
  }
  assert.deepEqual(imageGridSlots(4, ["A"]), ["A", null, null, null]);
  assert.deepEqual(imageGridSlots(4, ["A", "B", "C"]), ["A", "B", "C", null]);
  assert.equal(publicImageGridColumns(4, 2), 2);
  assert.equal(publicImageGridColumns(3, 3), 3);
});

test("legacy size falls back to defaults without hiding existing grid data", () => {
  assert.deepEqual(normalizeImageGridConfig({ columns: 4 }),
    { columns: 4, width_percent: 100, offset_percent: 0, spacing_top: "normal", spacing_bottom: "normal", aspect_ratio: 1.5 });
  assert.deepEqual(normalizeImageGridConfig({ columns: 2, width_percent: -10, aspect_ratio: 99 }),
    { columns: 2, width_percent: 100, offset_percent: 0, spacing_top: "normal", spacing_bottom: "normal", aspect_ratio: 1.5 });
});

test("pointer movement previews width and height separately within safe bounds", () => {
  const start = { width: 80, ratio: 1.5, parentWidth: 1000, tileWidth: 400 };
  assert.deepEqual(resizeImageGridFromPointer(start, 100, 0), { width: 90, ratio: 1.5 });
  assert.equal(resizeImageGridFromPointer(start, 0, 100).width, 80);
  assert.ok(resizeImageGridFromPointer(start, 0, 100).ratio < 1.5);
  assert.ok(resizeImageGridFromPointer(start, 0, -100).ratio > 1.5);
  assert.equal(resizeImageGridFromPointer(start, -10000, 0).width, 25);
  assert.equal(resizeImageGridFromPointer(start, 10000, 0).width, 100);
  assert.deepEqual(parseImageGridSize("75", "1.25"), { width_percent: 75, aspect_ratio: 1.25 });
  assert.equal(parseImageGridSize("24", "1.25"), null);
});

test("mobile stylesheet uses a single minmax column and the shared canvas resets block width", () => {
  const css = readFileSync(new URL("../src/components/portal/profile-content-blocks.module.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  const canvas = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(canvas, /@media \(max-width: 640px\)[\s\S]*\.profile-content-canvas \.profile-content-block[\s\S]*width: 100% !important;[\s\S]*margin-left: 0 !important/);
});
