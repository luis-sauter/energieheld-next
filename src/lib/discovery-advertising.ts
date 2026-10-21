import "server-only";
import { loadPublicAds } from "./public-ads";
import { loadPublicSidebarOrder } from "./public-sidebar-order";
import { loadInlineBannerOptions } from "./inline-advertising-loader";
import { inlineAdContext } from "./inline-ad-context";
import { loadTravelSearchBanners } from './public-travel-search-banners';
import { destinationBanners } from './destination-banners';
import { staticPremiumAds } from './motto-rows';

export async function loadDiscoveryAdvertising(path: string, allPublicBanners = false) {
  const context = inlineAdContext(path);
  if (!context || context.target_type !== "portal_area") return;
  const [ads, sidebarOrder, options, pool] = await Promise.all([
    loadPublicAds(undefined, "portal_area", context.target_key!), loadPublicSidebarOrder(), loadInlineBannerOptions(path),
    (allPublicBanners && path.startsWith('/reiseziele/')) || path === '/mottoreisen' || path.startsWith('/mottoreisen/') ? loadTravelSearchBanners() : Promise.resolve(null),
  ]);
  return { ads, sidebarOrder, options,
    premiumAds: staticPremiumAds(ads, pool?.banners.map(banner => banner.ad)),
    sliderAds: pool && allPublicBanners ? destinationBanners(ads, pool.banners) : ads };
}
export type DiscoveryAdvertisingData = NonNullable<Awaited<ReturnType<typeof loadDiscoveryAdvertising>>>;
