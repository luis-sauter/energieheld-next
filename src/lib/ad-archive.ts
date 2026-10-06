import type { AdCampaign } from './ad-values';

// Identity is explicit lineage, never a creative's name, URL or image.
export function selectableArchivedBanners(rows: AdCampaign[]) {
  const groups = new Map<string, AdCampaign[]>();
  for (const row of rows) {
    const key = row.lifecycle_group_id ?? row.id;
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => {
    if (group.some(row => !row.archived_at)) return [];
    const latest = group.filter(row => !row.deletion_requested_at).sort((a, b) =>
      new Date(b.archived_at ?? 0).getTime() - new Date(a.archived_at ?? 0).getTime() ||
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime() || b.id.localeCompare(a.id))[0];
    return latest ? [{ id: latest.id, name: latest.headline || latest.internal_name || 'Archivierter Banner' }] : [];
  });
}
