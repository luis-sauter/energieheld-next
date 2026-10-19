import { adTargetUrl, type ActiveAd } from './ad-values';
import type { TravelSearchBanner } from './travel-search-banners';
import { bannerSearchIdentity } from './portal-search-banners';
import { visibleMottoAds } from './motto-rows';

// Only accept the already-resolved public pool, never raw campaigns or static
// fallback assets. Local presentation wins for the same campaign/advertiser.
export function destinationBanners(local: ActiveAd[], publicPool: TravelSearchBanner[]): ActiveAd[] {
  local = local.filter(ad => ad.source !== 'legacy');
  const identities = new Set(local.filter(ad => ad.source !== 'hidden' && adTargetUrl(ad.target_url)).map(bannerSearchIdentity));
  const ids = new Set(local.map(ad => ad.id));
  const result = visibleMottoAds(local);
  for (const banner of publicPool) {
    const ad = banner.ad;
    if (ad.source === 'legacy' || !visibleMottoAds([ad]).length || ids.has(ad.id) || identities.has(banner.banner_key) || identities.has(bannerSearchIdentity(ad))) continue;
    ids.add(ad.id);
    identities.add(banner.banner_key);
    identities.add(bannerSearchIdentity(ad));
    result.push(ad);
  }
  return result;
}
