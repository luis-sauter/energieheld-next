import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import { filterTravelDiscovery } from "./reiseportal-search";
import type { Listing } from "@/types/portal";

export function relatedTravelPages(listings: Listing[]) {
  const keys = new Set(listings.flatMap(listing => listing.travelTermKeys ?? []));
  return {
    themes: travelThemes.filter(entry => keys.has(`theme:${entry.slug}`))
      .map(entry => ({ name: entry.title, path: `/mottoreisen/${entry.slug}` })),
    destinations: destinations.filter(entry => filterTravelDiscovery(listings, entry.slug, "").length > 0)
      .map(entry => ({ name: entry.title, path: `/reiseziele/${entry.slug}` })),
  };
}
