import type { ActiveAd, AdPlacementId } from './ad-values';

// Ten managed homepage placements. Never supplement with foreign or static
// inventory; each visible creative has its own normally editable page slot.
export function homeBannerRows(ads: ActiveAd[]): [ActiveAd[], ActiveAd[]] {
  const slots: AdPlacementId[][] = [['sidebar_top', 'sidebar_middle', 'sidebar_bottom', 'sidebar_07', 'sidebar_08'], ['sidebar_04', 'sidebar_05', 'sidebar_06', 'sidebar_09', 'sidebar_10']];
  const rows = slots.map(group => group.flatMap(slot => ads.filter(ad => ad.placement === slot && ad.source !== 'legacy' && ad.imageUrl && !ad.suppressed)));
  return rows as [ActiveAd[], ActiveAd[]];
}
