import type { ActiveAd, AdPlacementId } from "./ad-values";
import { legacyBannerPages } from "../data/legacy-banner-pages";
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
  display_source?: AdPlacementId | null;
};
// A bijection of booking/content sources to visible positions; Premium is never mapped.
export function displaySource(placement: AdPlacementId, rows: BannerPresentation[]): AdPlacementId {
  if (placement === "top_banner") return placement;
  const sources = defaultSidebarOrder.map((slot) => rows.find((row) => row.placement === slot)?.display_source ?? slot);
  if (new Set(sources).size !== 12 || sources.some((slot) => !defaultSidebarOrder.includes(slot as typeof defaultSidebarOrder[number]))) return placement;
  return sources[defaultSidebarOrder.indexOf(placement as typeof defaultSidebarOrder[number])] ?? placement;
}
export function displayPlacement(source: AdPlacementId, rows: BannerPresentation[]): AdPlacementId {
  return source === "top_banner" ? source : defaultSidebarOrder.find((slot) => displaySource(slot, rows) === source) ?? source;
}
export function legacyCreative(placement: AdPlacementId, source: AdPlacementId = placement, path = "/"): ActiveAd | undefined {
  const creative = legacyBannerPages[path]?.find((item) => item.placement === source);
  return creative && { id: creative.id, placement, headline: creative.alt, body_text: null,
    target_url: creative.targetUrl, image_path: null, imageUrl: creative.imageUrl, source: "legacy",
    banner_size: creative.size, image_width: creative.width, image_height: creative.height, legacy_source: source, mobile_image: creative.mobile };
}
// One resolver for public delivery and the admin's actual visible occupancy.
export function presentedBanners(ads: ActiveAd[], presentations: BannerPresentation[], path = "/"): ActiveAd[] {
  const slots = ["top_banner", ...defaultSidebarOrder] as AdPlacementId[];
  const contents = slots.flatMap<ActiveAd>((placement) => {
    const setting = presentations.find((item) => item.placement === placement);
    const live = ads.find((ad) => ad.placement === placement);
    if (live?.image_path && !live.imageUrl) return [{ ...live, suppressed: true }];
    if (live) return [{ ...live, source: "campaign" as const, banner_size: setting?.size }];
    if (setting?.legacy_hidden) return [{ id: `hidden:${placement}`, placement, headline: "", body_text: null,
      target_url: "", image_path: null, suppressed: true, source: "hidden" as const, banner_size: setting.size }];
    const legacy = legacyCreative(placement, setting?.legacy_placement ?? placement, path);
    return legacy ? [{ ...legacy, banner_size: setting?.size ?? legacy.banner_size,
      target_url: setting?.legacy_target_url || legacy.target_url }]
      : setting?.legacy_placement ? [{ id: `hidden:${placement}`, placement, headline: "", body_text: null,
        target_url: "", image_path: null, suppressed: true, source: "hidden" as const }] : [];
  });
  return slots.flatMap((placement) => {
    const ad = contents.find((item) => item.placement === displaySource(placement, presentations));
    return ad ? [{ ...ad, placement }] : [];
  });
}
