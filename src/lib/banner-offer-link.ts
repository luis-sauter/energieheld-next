import { adPlacements, type AdPlacementId, type AdTarget } from "./ad-values";
import { portalAdSection } from "./ad-target-areas";
export function bannerOfferTarget(page: string, placement: string): AdTarget | undefined {
  if (!Object.hasOwn(adPlacements, placement)) return;
  const slot = placement as AdPlacementId;
  if (page === "/") return { target_type: "homepage", category_id: null, placement: slot };
  if (page === "/unterkuenfte-a-z") return { target_type: "experts_directory", category_id: null, placement: slot };
  const key = page.startsWith("/") ? page.slice(1) : "";
  if (portalAdSection(key)) return { target_type: "portal_area", target_key: key, category_id: null, placement: slot };
}
export function bannerOfferHref(placement: AdPlacementId, page?: string) {
  const query = new URLSearchParams({ platz: placement });
  if (page && bannerOfferTarget(page, placement)) query.set("seite", page);
  return "/angebot-anfragen?" + query.toString();
}
