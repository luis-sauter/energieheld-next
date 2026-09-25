import type { ActiveAd } from "./ad-values";
import { defaultSidebarOrder, type SidebarSlot } from "./sidebar-order";
import { legacyBannerPreview } from "../data/legacy-banner-preview";

export function sidebarCreative(
  slot: SidebarSlot,
  ads: ActiveAd[],
  fallback: readonly (typeof legacyBannerPreview)[number][] = legacyBannerPreview,
): ActiveAd | undefined {
  const live = ads.find((ad) => ad.placement === slot && ad.imageUrl);
  if (live) return live;
  const order = defaultSidebarOrder.indexOf(slot);
  const legacy = fallback.find((creative) => creative.order === order);
  return legacy && {
    id: legacy.id,
    placement: slot,
    headline: legacy.alt,
    body_text: null,
    target_url: legacy.targetUrl,
    image_path: null,
    imageUrl: legacy.imageUrl,
  };
}
