import type { ActiveAd } from "./ad-values";
import type { InlineBanner } from "./inline-ad-context";
import { legacyBannerPreview } from "../data/legacy-banner-preview";
import { defaultSidebarOrder, type SidebarSlot } from "./sidebar-order";

// Sources describe content; destination positions are always A–L.
export function sidebarContentAt(ads: ActiveAd[], sources: readonly SidebarSlot[], index: number) {
  const content = ads.find((ad) => ad.placement === sources[index]);
  return content && { ...content, placement: defaultSidebarOrder[index] };
}

export function sidebarContentToken(slot: SidebarSlot, ad?: ActiveAd, banner?: InlineBanner): string {
  const content = banner ?? ad;
  if (!content || ("suppressed" in content && content.suppressed && content.source !== "campaign")) return "";
  if (content.source !== "legacy") return content.id;
  const legacy = legacyBannerPreview.find((item) => item.id === content.id);
  return legacy ? `legacy:${defaultSidebarOrder[legacy.order]}` : `legacy:${slot}`;
}
