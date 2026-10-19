import type { ActiveAd, AdPlacementId } from './ad-values';
import type { TravelSearchBanner } from './travel-search-banners';
import { destinationBanners } from './destination-banners';

// Keep the six assigned homepage creatives first, then supplement from the
// existing public pool. Select once on the server; no requests during rotation.
export function homeBannerRows(ads: ActiveAd[], pool: TravelSearchBanner[]): [ActiveAd[], ActiveAd[]] {
  const slots: AdPlacementId[][] = [['sidebar_top', 'sidebar_middle', 'sidebar_bottom'], ['sidebar_04', 'sidebar_05', 'sidebar_06']];
  const rows = slots.map(group => group.flatMap(slot => ads.filter(ad => ad.placement === slot && ad.imageUrl && !ad.suppressed)));
  const used = new Set(rows.flat().map(ad => ad.id));
  const additional = destinationBanners(ads, pool).filter(ad => !used.has(ad.id) && ad.placement !== 'top_banner');
  for (const row of rows) while (row.length < 5 && additional.length) row.push(additional.shift()!);
  return rows as [ActiveAd[], ActiveAd[]];
}
