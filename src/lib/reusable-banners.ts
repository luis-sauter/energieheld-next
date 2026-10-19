import type { AdCampaign } from './ad-values';

// Only managed creatives. Historical static banners never re-enter through reuse.
export function reusableBanners(rows: AdCampaign[]) {
  return rows.filter(row => !row.deletion_requested_at && row.image_path && row.target_url)
    .map(row => ({ id: row.id, name: row.headline || row.internal_name || 'Banner', archived: Boolean(row.archived_at) }));
}
