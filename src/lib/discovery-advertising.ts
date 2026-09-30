import "server-only";
import { loadPublicAds } from "./public-ads";
import { loadPublicSidebarOrder } from "./public-sidebar-order";
import { loadInlineBannerOptions } from "./inline-advertising-loader";
import { inlineAdContext } from "./inline-ad-context";

export async function loadDiscoveryAdvertising(path: string) {
  const context = inlineAdContext(path);
  if (!context || context.target_type !== "portal_area") return;
  const [ads, sidebarOrder, options] = await Promise.all([
    loadPublicAds(undefined, "portal_area", context.target_key!), loadPublicSidebarOrder(), loadInlineBannerOptions(path),
  ]);
  return { ads, sidebarOrder, options };
}
export type DiscoveryAdvertisingData = NonNullable<Awaited<ReturnType<typeof loadDiscoveryAdvertising>>>;
