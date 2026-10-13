import { createHash } from "node:crypto";
import locations from "../data/company-locations.json" with { type: "json" };
import addresses from "../data/company-location-addresses.json" with { type: "json" };
import { publicMapLocations } from "./europe-map";
import type { Listing } from "@/types/portal";

// Reuse the already loaded public directory. No DB, geocoder or storage calls.
// A cached location cannot keep an archived/unpublished or moved profile visible.
export function companyMapLocations(listings: Listing[]) {
  const fingerprints: Record<string, string> = addresses;
  const publicIds = new Set(listings.filter(listing => {
    if (listing.isDemo || listing.isPreview) return false;
    const address = [listing.location.street, listing.location.postalCode, listing.location.city, listing.location.country]
      .map(value => (value ?? "").normalize("NFC").trim().toLocaleLowerCase("de")).join("|");
    return fingerprints[listing.id] === createHash("sha256").update(address).digest("hex");
  }).map(listing => listing.id));
  return publicMapLocations(locations, publicIds);
}
