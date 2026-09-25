import test from "node:test";
import assert from "node:assert/strict";
import { defaultSidebarOrder, isSidebarOrder, orderedSidebarSlots, moveSidebarSlot } from "../src/lib/sidebar-order.ts";

test("public order accepts exactly three fixed slots and sorts them by stored position", () => {
  const rows = [
    { slot: "sidebar_top", sort_order: 2 },
    { slot: "sidebar_middle", sort_order: 0 },
    { slot: "sidebar_bottom", sort_order: 1 },
  ];
  assert.deepEqual(orderedSidebarSlots(rows), ["sidebar_middle", "sidebar_bottom", "sidebar_top"]);
  assert.equal(isSidebarOrder(["sidebar_top", "sidebar_middle", "sidebar_bottom"]), true);
  assert.equal(isSidebarOrder(["sidebar_top", "sidebar_top", "sidebar_bottom"]), false);
  assert.equal(isSidebarOrder(["top_banner", "sidebar_middle", "sidebar_bottom"]), false);
});

test("missing, duplicate or invalid rows fall back to the prior public order", () => {
  for (const rows of [
    [],
    [{ slot: "sidebar_top", sort_order: 0 }],
    [{ slot: "sidebar_top", sort_order: 0 }, { slot: "sidebar_middle", sort_order: 0 }, { slot: "sidebar_bottom", sort_order: 2 }],
    [{ slot: "top_banner", sort_order: 0 }, { slot: "sidebar_middle", sort_order: 1 }, { slot: "sidebar_bottom", sort_order: 2 }],
  ]) assert.deepEqual(orderedSidebarSlots(rows), [...defaultSidebarOrder]);
});

test("pointer and arrow previews move only local slot arrays", () => {
  const source = [...defaultSidebarOrder];
  assert.deepEqual(moveSidebarSlot(source, 0, 2), ["sidebar_middle", "sidebar_bottom", "sidebar_top"]);
  assert.deepEqual(moveSidebarSlot(source, 2, 1), ["sidebar_top", "sidebar_bottom", "sidebar_middle"]);
  assert.deepEqual(source, [...defaultSidebarOrder]);
  assert.equal(moveSidebarSlot(source, 0, -1), source);
});
