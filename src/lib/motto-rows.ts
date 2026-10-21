import type { ActiveAd } from './ad-values';
import { adTargetUrl } from './ad-values';

// Called once on the server. The resulting React children are hydrated in the
// same order; neither the client nor row navigation generates another seed.
export function orderMottoItems<T>(items: readonly T[], key: (item: T) => string, seed: string): T[] {
  const result = [...new Map(items.map(item => [key(item), item])).values()];
  let state = [...seed].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
  for (let i = result.length - 1; i > 0; i--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function mottoGroups<T>(items: readonly T[], maximumRows = 3): T[][] {
  if (!items.length) return [];
  const count = Math.min(Math.max(1, maximumRows), items.length);
  const size = Math.floor(items.length / count), extra = items.length % count;
  let start = 0;
  return Array.from({ length: count }, (_, i) => {
    const row = items.slice(start, start + size + Number(i < extra));
    start += row.length;
    return row;
  });
}

export function visibleMottoAds(ads: readonly ActiveAd[]): ActiveAd[] {
  return [...new Map(ads.filter(ad => ad.imageUrl && !ad.suppressed && adTargetUrl(ad.target_url))
    .map(ad => [ad.id, ad])).values()];
}

export function staticPremiumAds(local: readonly ActiveAd[], pool: readonly ActiveAd[] = []) {
  // These older creatives were rejected for the newly added horizontal slots.
  // Their existing campaigns elsewhere remain intact.
  const incompatible = new Set(['870c4024-25ec-4c13-9b8b-180599f145fe', '7f1c06f6-9946-4f0e-90bc-7fb9499ed010']);
  return visibleMottoAds([...local, ...pool].filter(ad => ad.placement === 'top_banner' && ad.source !== 'legacy' && !incompatible.has(ad.id)))
    .filter((ad, index, all) => all.findIndex(other => other.image_path === ad.image_path) === index).slice(0, 2);
}
