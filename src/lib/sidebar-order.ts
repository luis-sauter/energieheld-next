export const defaultSidebarOrder = [
  "sidebar_top",
  "sidebar_middle",
  "sidebar_bottom",
] as const;
export type SidebarSlot = (typeof defaultSidebarOrder)[number];

export function isSidebarOrder(value: unknown): value is SidebarSlot[] {
  return Array.isArray(value) && value.length === 3 &&
    new Set(value).size === 3 &&
    value.every((slot) => defaultSidebarOrder.includes(slot));
}

export function orderedSidebarSlots(rows: { slot: string; sort_order: number }[]): SidebarSlot[] {
  if (!isSidebarOrder(rows.map((row) => row.slot)) ||
    rows.some((row) => !Number.isInteger(row.sort_order) || row.sort_order < 0 || row.sort_order > 2) ||
    new Set(rows.map((row) => row.sort_order)).size !== 3)
    return [...defaultSidebarOrder];
  return [...rows].sort((a, b) => a.sort_order - b.sort_order).map((row) => row.slot) as SidebarSlot[];
}

export function moveSidebarSlot(slots: SidebarSlot[], from: number, to: number): SidebarSlot[] {
  if (from < 0 || to < 0 || from >= slots.length || to >= slots.length || from === to)
    return slots;
  const next = [...slots];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
