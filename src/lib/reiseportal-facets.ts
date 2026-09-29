import type { Listing } from "@/types/portal";
import { filterListings } from "./listings";
import { filterTravelDiscovery } from "./reiseportal-search";
import type { TravelFilterValues } from "./reiseportal-filter-options";

export type TravelFacet = "destination" | "theme" | "audience" | "accommodation" | "feature";
export const travelFilterParams: Record<keyof TravelFilterValues, string> = {
  destination: "ziel", theme: "thema", audience: "zielgruppe", accommodation: "unterkunftstyp",
  feature: "besonderheit", query: "q", location: "ort", sort: "sort",
};

export function filterTravelListings(items: Listing[], values: TravelFilterValues): Listing[] {
  const matching = filterListings(items, {
    query: values.query, category: "", location: values.location, service: "", sort: values.sort,
  }, true);
  return filterTravelDiscovery(matching, values.destination, values.theme, values.audience,
    values.accommodation, values.feature);
}

// Each option keeps the other selected dimensions, replacing only its own value.
export function travelFacetCount(items: Listing[], values: TravelFilterValues, facet: TravelFacet, slug: string): number {
  return filterTravelListings(items, { ...values, [facet]: slug }).length;
}

export function travelFilterUrl(values: TravelFilterValues): string {
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(travelFilterParams) as [keyof TravelFilterValues, string][]) {
    const value = values[key].trim();
    if (value) params.set(param, value);
  }
  const query = params.toString();
  return `/unterkuenfte-a-z${query ? `?${query}` : ""}`;
}
