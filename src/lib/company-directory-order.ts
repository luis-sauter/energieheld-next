export type DirectoryOrderRow = {
  profile_id: string | null;
  demo_slug?: string | null;
  item_key?: string;
  sort_order: number;
};

export function directoryItemKey(item: { id: string; slug?: string; isDemo?: boolean }) {
  return item.isDemo ? `demo:${item.slug}` : `profile:${item.id}`;
}

export function realDirectoryIds<T extends { id: string; isDemo: boolean }>(listings: T[]) {
  return listings.filter((listing) => !listing.isDemo).map((listing) => listing.id);
}

export function sortByDirectoryOrder<T extends { id: string; slug?: string; isDemo?: boolean }>(
  profiles: T[],
  orderRows: DirectoryOrderRow[],
): T[] {
  const positions = new Map(orderRows.map((row) => [
    row.item_key ?? (row.demo_slug ? `demo:${row.demo_slug}` : `profile:${row.profile_id}`),
    row.sort_order,
  ]));
  return profiles.map((item, index) => ({ item, index })).sort((a, b) => {
    const aOrder = positions.get(directoryItemKey(a.item));
    const bOrder = positions.get(directoryItemKey(b.item));
    if (aOrder === undefined && bOrder !== undefined) return 1;
    if (aOrder !== undefined && bOrder === undefined) return -1;
    if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder)
      return aOrder - bOrder;
    if (aOrder === undefined && bOrder === undefined) {
      if (Boolean(a.item.isDemo) !== Boolean(b.item.isDemo)) return a.item.isDemo ? 1 : -1;
      if (a.item.isDemo) return a.index - b.index;
    }
    const aKey = directoryItemKey(a.item);
    const bKey = directoryItemKey(b.item);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  }).map(({ item }) => item);
}

export function moveDirectoryId(ids: string[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length || from === to)
    return ids;
  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
