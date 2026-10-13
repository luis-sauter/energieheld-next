import { createHash } from "node:crypto";
import locations from "../data/company-locations.json" with { type: "json" };
import addresses from "../data/company-location-addresses.json" with { type: "json" };
import advertiserLocations from "../data/company-location-advertisers.json" with { type: "json" };
import { publicMapLocations } from "./europe-map";
import type { Listing } from "@/types/portal";
import type { TravelSearchBanner } from "./travel-search-banners";

export type MapAdvertiser = { locationId: string; advertiserKey: string; campaignIds: string[] };
type PublicMapBanner = TravelSearchBanner & { ad: TravelSearchBanner["ad"] & { archived_at?: string | null } };

// Only already resolved, publicly deliverable campaign creatives may qualify.
// Legacy fallbacks, expired/archived campaigns and unrelated same-name firms do not.
export function publicAdvertiserLocationIds(banners: PublicMapBanner[], registered: MapAdvertiser[] = advertiserLocations, today = new Date().toISOString().slice(0, 10)) {
  const ids = new Set<string>();
  for (const banner of banners) {
    const ad = banner.ad;
    if (ad.source !== "campaign" || ad.suppressed || ad.archived_at || !ad.imageUrl || banner.commercial === false ||
      (ad.status && ad.status !== "approved") ||
      (ad.approved_start_date && ad.approved_start_date > today) || (ad.approved_end_date && ad.approved_end_date < today)) continue;
    const profileId = banner.profile_id ?? (banner.advertiser_key?.startsWith("profile:") ? banner.advertiser_key.slice(8) : null);
    if (profileId) ids.add(profileId);
    for (const entry of registered) if (entry.advertiserKey === banner.advertiser_key && entry.campaignIds.includes(ad.id)) ids.add(entry.locationId);
  }
  return ids;
}

// Reuse the already loaded public directory. No DB, geocoder or storage calls.
// A cached location cannot keep an archived/unpublished or moved profile visible.
export function companyMapLocations(listings: Listing[], banners: TravelSearchBanner[] = []) {
  const fingerprints: Record<string, string> = addresses;
  const publicIds = new Set(listings.filter(listing => {
    if (listing.isDemo || listing.isPreview) return false;
    const address = [listing.location.street, listing.location.postalCode, listing.location.city, listing.location.country]
      .map(value => (value ?? "").normalize("NFC").trim().toLocaleLowerCase("de")).join("|");
    return fingerprints[listing.id] === createHash("sha256").update(address).digest("hex");
  }).map(listing => listing.id));
  const advertiserIds = publicAdvertiserLocationIds(banners);
  // If a currently public profile moved, a cached campaign alias must not revive its old address.
  for (const listing of listings) if (!publicIds.has(listing.id)) advertiserIds.delete(listing.id);
  advertiserIds.forEach(id => publicIds.add(id));
  return publicMapLocations(locations, publicIds);
}
