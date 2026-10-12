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

export function mottoGroups<T>(items: readonly T[], size = 6): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
}

export function visibleMottoAds(ads: readonly ActiveAd[]): ActiveAd[] {
  return [...new Map(ads.filter(ad => ad.imageUrl && !ad.suppressed && adTargetUrl(ad.target_url))
    .map(ad => [ad.id, ad])).values()];
}
