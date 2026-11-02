import corrections from "../data/provider-preview-corrections.json" with { type: "json" };
import type { Listing } from "@/types/portal";

// An explicit editorial correction only replaces the reviewed old selection.
// A later image chosen in the editor always takes precedence.
export function correctProviderPreview(listing: Listing): Listing {
  const correction = (corrections as Record<string, { src: string; alt: string; replacesAssetId: string | null }>)[listing.id];
  if (!correction || (listing.cardImageAssetId ?? null) !== correction.replacesAssetId) return listing;
  return { ...listing, travelImage: { src: correction.src, alt: correction.alt },
    cardImageAssetId: undefined, cardImageCrop: undefined };
}
