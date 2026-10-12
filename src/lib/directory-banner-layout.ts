import type { ActiveAd } from "./ad-values";

// Inputs come from the existing active-slot/search delivery; never load additional campaigns.
export function directoryBannerPool(ads: ActiveAd[]) {
  const seen = new Set<string>();
  return ads.filter(ad => {
    if (ad.suppressed || !ad.imageUrl || seen.has(ad.id)) return false;
    seen.add(ad.id); return true;
  });
}
export function directoryBannerSequence(pool: ActiveAd[], count: number, previousId?: string) {
  if (!pool.length || count < 1) return [];
  // A single creative cannot be repeated immediately; show it once instead.
  if (pool.length === 1) return pool[0].id === previousId ? [] : [pool[0]];
  const start = pool[0].id === previousId ? 1 : 0;
  return Array.from({ length: count }, (_, index) => pool[(start + index) % pool.length]);
}
