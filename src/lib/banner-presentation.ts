import type { ActiveAd, AdPlacementId } from "./ad-values";
import { legacyBannerPreview } from "../data/legacy-banner-preview";
import { defaultSidebarOrder } from "./sidebar-order";

export const bannerSizes = { small: "Klein", medium: "Mittel", large: "Groß" } as const;
export type BannerSize = keyof typeof bannerSizes;
// The real legacy references are 350×120 (small) and 350×350 (City Apart).
const referenceHeights = { small: 120 / 350, medium: (120 + 350) / 2 / 350, large: 1 };
export function bannerWidth(size: BannerSize, imageRatio: number) {
  return Math.min(1, referenceHeights[size] * imageRatio) * 100;
}
export type BannerPresentation = {
  placement: AdPlacementId;
  size: BannerSize;
  legacy_hidden: boolean;
  legacy_target_url: string | null;
  legacy_placement?: AdPlacementId | null;
};
export function legacyCreative(placement: AdPlacementId, source: AdPlacementId = placement): ActiveAd | undefined {
  const creative = legacyBannerPreview.find((item) => defaultSidebarOrder[item.order] === source);
  return creative && { id: creative.id, placement, headline: creative.alt, body_text: null,
    target_url: creative.targetUrl, image_path: null, imageUrl: creative.imageUrl, source: "legacy" };
}
// One resolver for public delivery and the admin's actual visible occupancy.
export function presentedBanners(ads: ActiveAd[], presentations: BannerPresentation[]): ActiveAd[] {
  const slots = ["top_banner", ...defaultSidebarOrder] as AdPlacementId[];
  return slots.flatMap<ActiveAd>((placement) => {
    const setting = presentations.find((item) => item.placement === placement);
    const live = ads.find((ad) => ad.placement === placement);
    if (live?.image_path && !live.imageUrl) return [{ ...live, suppressed: true }];
    if (live) return [{ ...live, source: "campaign" as const, banner_size: setting?.size }];
    if (setting?.legacy_hidden) return [{ id: `hidden:${placement}`, placement, headline: "", body_text: null,
      target_url: "", image_path: null, suppressed: true, source: "hidden" as const, banner_size: setting.size }];
    const legacy = legacyCreative(placement, setting?.legacy_placement ?? placement);
    return legacy ? [{ ...legacy, banner_size: setting?.size,
      target_url: setting?.legacy_target_url || legacy.target_url }]
      : setting?.legacy_placement ? [{ id: `hidden:${placement}`, placement, headline: "", body_text: null,
        target_url: "", image_path: null, suppressed: true, source: "hidden" as const }] : [];
  });
}
