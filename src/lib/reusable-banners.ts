import type { AdCampaign } from './ad-values';
import { legacyBannerPages } from '../data/legacy-banner-pages';

export function reusableBanners(rows: AdCampaign[]) {
  const campaigns = rows.filter(row => !row.deletion_requested_at && row.image_path && row.target_url)
    .map(row => ({ id: row.id, name: row.headline || row.internal_name || 'Banner', archived: Boolean(row.archived_at) }));
  const seen = new Set<string>();
  const legacy = Object.entries(legacyBannerPages).flatMap(([path, banners]) => banners.flatMap(banner => {
    const key = `${banner.imageUrl}|${banner.targetUrl}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: `legacy:${path}:${banner.placement}`, name: banner.alt, archived: false }];
  }));
  return [...campaigns, ...legacy];
}
