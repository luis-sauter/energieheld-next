import 'server-only';
import type { ActiveAd } from './ad-values';
import type { TravelSearchBanner } from './travel-search-banners';
import { inlineAdContext, type InlineBannerOptions } from './inline-ad-context';

// Reused creatives keep the original campaign's authorized editing context.
// Never bind a borrowed campaign to the current page's unrelated occupied slot.
export async function loadBorrowedBannerEditing(ads: ActiveAd[], pool: TravelSearchBanner[], local?: InlineBannerOptions) {
  const result: Record<string, InlineBannerOptions> = {};
  if (!local) return result;
  const sources = new Map<string, string>();
  for (const ad of ads) {
    if (local.banners.some(banner => banner.id === ad.id)) { result[ad.id] = local; continue; }
    const source = pool.find(banner => banner.ad.id === ad.id && banner.ad.image_path === ad.image_path)?.source_path;
    if (source && inlineAdContext(source, true)) sources.set(ad.id, source);
  }
  if (!sources.size) return result;
  const { loadInlineBannerOptions } = await import('./inline-advertising-loader');
  const loaded = new Map(await Promise.all([...new Set(sources.values())].map(async path =>
    [path, await loadInlineBannerOptions(path)] as const)));
  for (const [id, path] of sources) {
    const options = loaded.get(path);
    if (options && !options.error && options.banners.some(banner => banner.id === id)) result[id] = options;
  }
  return result;
}
