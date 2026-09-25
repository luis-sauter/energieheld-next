import test from "node:test";
import assert from "node:assert/strict";
import { defaultSidebarOrder, isSidebarOrder, orderedSidebarSlots, moveSidebarSlot } from "../src/lib/sidebar-order.ts";

test("twelve stable sidebar positions exclude the separate top banner", () => {
  assert.equal(defaultSidebarOrder.length, 12);
  assert.deepEqual(defaultSidebarOrder.slice(0, 3), ["sidebar_top", "sidebar_middle", "sidebar_bottom"]);
  assert.deepEqual(defaultSidebarOrder.slice(3), Array.from({ length: 9 }, (_, i) => `sidebar_${String(i + 4).padStart(2, "0")}`));
  assert.equal(defaultSidebarOrder.includes("top_banner"), false);
  assert.equal(isSidebarOrder([...defaultSidebarOrder]), true);
  assert.equal(isSidebarOrder([...defaultSidebarOrder.slice(0, 11), "sidebar_top"]), false);
  assert.equal(isSidebarOrder([...defaultSidebarOrder.slice(0, 11), "top_banner"]), false);
  assert.equal(isSidebarOrder(defaultSidebarOrder.slice(0, 3)), false);
});

test("public order uses all stored positions and rejects corrupt rows", () => {
  const reversed = [...defaultSidebarOrder].reverse();
  assert.deepEqual(orderedSidebarSlots(reversed.map((slot, sort_order) => ({ slot, sort_order }))), reversed);
  for (const rows of [
    [],
    defaultSidebarOrder.slice(0, 3).map((slot, sort_order) => ({ slot, sort_order })),
    defaultSidebarOrder.map((slot) => ({ slot, sort_order: 0 })),
    [...defaultSidebarOrder.slice(0, 11), "top_banner"].map((slot, sort_order) => ({ slot, sort_order })),
  ]) assert.deepEqual(orderedSidebarSlots(rows), [...defaultSidebarOrder]);
});

test("first, middle and last slots move in local previews without mutating source", () => {
  const source = [...defaultSidebarOrder];
  assert.equal(moveSidebarSlot(source, 0, 11).at(-1), "sidebar_top");
  assert.equal(moveSidebarSlot(source, 6, 5)[5], source[6]);
  assert.equal(moveSidebarSlot(source, 11, 0)[0], "sidebar_12");
  assert.deepEqual(source, [...defaultSidebarOrder]);
  assert.equal(moveSidebarSlot(source, 0, -1), source);
});
