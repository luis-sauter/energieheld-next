export const defaultSidebarOrder = [
  "sidebar_top",
  "sidebar_middle",
  "sidebar_bottom",
  "sidebar_04",
  "sidebar_05",
  "sidebar_06",
  "sidebar_07",
  "sidebar_08",
  "sidebar_09",
  "sidebar_10",
  "sidebar_11",
  "sidebar_12",
] as const;
export type SidebarSlot = (typeof defaultSidebarOrder)[number];

export function isSidebarOrder(value: unknown): value is SidebarSlot[] {
  return Array.isArray(value) && value.length === defaultSidebarOrder.length &&
    new Set(value).size === defaultSidebarOrder.length &&
    value.every((slot) => defaultSidebarOrder.includes(slot as SidebarSlot));
}

export function orderedSidebarSlots(rows: { slot: string; sort_order: number }[]): SidebarSlot[] {
  if (!isSidebarOrder(rows.map((row) => row.slot)) ||
    rows.some((row) => !Number.isInteger(row.sort_order) || row.sort_order < 0 || row.sort_order >= defaultSidebarOrder.length) ||
    new Set(rows.map((row) => row.sort_order)).size !== defaultSidebarOrder.length)
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
