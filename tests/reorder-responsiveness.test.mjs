import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moveImageId } from "../src/lib/media-order.ts";
import { defaultSidebarOrder, moveSidebarSlot } from "../src/lib/sidebar-order.ts";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("image and banner previews move synchronously without changing the source order", () => {
  const images = ["a", "b", "c"];
  assert.deepEqual(moveImageId(images, "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(images, ["a", "b", "c"]);
  const slots = [...defaultSidebarOrder];
  assert.equal(moveSidebarSlot(slots, 0, 2)[2], "sidebar_top");
  assert.deepEqual(slots, defaultSidebarOrder);
});

test("inline gallery previews the new order before saving and rolls back failures", () => {
  const code = source("src/components/admin/use-inline-admin-media.tsx");
  const shift = code.slice(code.indexOf("async function shiftImage"), code.indexOf("const galleryEditor"));
  assert.ok(shift.indexOf("setOptimisticImages(") < shift.indexOf("await saveAction(form)"));
  assert.match(shift, /if \(result\.success\) router\.refresh\(\);\s*else setOptimisticImages\(/);
  assert.match(shift, /catch \{\s*setOptimisticImages\(/);
});

test("content image grid previews pointer moves and restores order on save failure", () => {
  const code = source("src/components/admin/inline-image-grid-editor.tsx");
  const reorder = code.slice(code.indexOf("async function reorder"), code.indexOf("function shift"));
  assert.ok(reorder.indexOf("setOrderOverride(") < reorder.indexOf("await run(data"));
  assert.match(reorder, /if \(!await run\([\s\S]*?setOrderOverride\(\{ base: baseOrder, ids: before \}\)/);
  assert.match(code, /onPointerMove=\{moveOrderDrag\}/);
  assert.match(code, /onPointerCancel=\{\(event\) => finishOrderDrag\(event, true\)\}/);
  assert.match(code, /imageGridSlots\(previewColumns, visibleImages\)/);
});

test("media grips use immediate mouse and touch pointer reordering with rollback", () => {
  const media = source("src/components/admin/admin-media-editor.tsx");
  const css = source("src/components/admin/admin-media.module.css");
  const gridCss = source("src/components/admin/inline-profile.module.css");
  assert.match(media, /onPointerMove=\{moveDrag\}/);
  assert.match(media, /onPointerUp=\{finishDrag\}/);
  assert.match(media, /onPointerCancel=\{\(event\) => finishDrag\(event, true\)\}/);
  assert.match(media, /if \(!result\.success\) \{[\s\S]*?setOrder\(committedRef\.current\)/);
  assert.match(css, /\.dragHandle \{[^}]*touch-action: none/s);
  assert.match(gridCss, /\.imageReorderHandle \{[^}]*touch-action: none/s);
});

test("banner pointer movement ignores the same hovered target until a new target is reached", () => {
  const code = source("src/components/admin/sidebar-order-editor.tsx");
  assert.match(code, /if \(lastTargetRef\.current === over\) return;\s*lastTargetRef\.current = over;\s*setTarget\(over\);\s*setDraft/);
  assert.match(code, /const result = await saveOrder\(draft, expectedRef.current\)/);
});
