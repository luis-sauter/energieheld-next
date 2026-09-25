export type DirectoryOrderRow = { profile_id: string; sort_order: number };

export function realDirectoryIds<T extends { id: string; isDemo: boolean }>(listings: T[]) {
  return listings.filter((listing) => !listing.isDemo).map((listing) => listing.id);
}

export function sortByDirectoryOrder<T extends { id: string }>(
  profiles: T[],
  orderRows: DirectoryOrderRow[],
): T[] {
  const positions = new Map(orderRows.map((row) => [row.profile_id, row.sort_order]));
  return [...profiles].sort((a, b) => {
    const aOrder = positions.get(a.id);
    const bOrder = positions.get(b.id);
    if (aOrder === undefined && bOrder !== undefined) return 1;
    if (aOrder !== undefined && bOrder === undefined) return -1;
    if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder)
      return aOrder - bOrder;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function moveDirectoryId(ids: string[], from: number, to: number) {
  if (from < 0 || to < 0 || from >= ids.length || to >= ids.length || from === to)
    return ids;
  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
