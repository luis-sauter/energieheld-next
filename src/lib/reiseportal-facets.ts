import type { Listing } from "@/types/portal";
import { filterListings } from "./listings";
import { filterTravelDiscovery } from "./reiseportal-search";
import type { TravelFilterValues } from "./reiseportal-filter-options";
import { publicImportPresentation } from "../config/import-presentation";

export type TravelFacet = "destination" | "theme" | "audience" | "accommodation" | "feature";
export const travelFilterParams: Record<keyof TravelFilterValues, string> = {
  destination: "ziel", theme: "thema", audience: "zielgruppe", accommodation: "unterkunftstyp",
  feature: "besonderheit", query: "q", location: "ort", sort: "sort",
};

export function filterTravelListings(items: Listing[], values: TravelFilterValues): Listing[] {
  const matching = filterListings(items, {
    query: values.query, category: "", location: values.location, service: "", sort: values.sort,
  }, true);
  const results = filterTravelDiscovery(matching, values.destination, values.theme, values.audience,
    values.accommodation, values.feature);
  if (values.sort === "imported" && publicImportPresentation.enabled) results.sort((a,b) =>
    Number(Boolean(b.importedAt)) - Number(Boolean(a.importedAt)) ||
    (Date.parse(b.importedAt ?? "") || 0) - (Date.parse(a.importedAt ?? "") || 0) ||
    a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id));
  return results;
}

// Each option keeps the other selected dimensions, replacing only its own value.
export function travelFacetCount(items: Listing[], values: TravelFilterValues, facet: TravelFacet, slug: string): number {
  return filterTravelListings(items, { ...values, [facet]: slug }).length;
}

export function travelFilterUrl(values: TravelFilterValues): string {
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(travelFilterParams) as [keyof TravelFilterValues, string][]) {
    if (key === "feature" || key === "location") continue; // Keep the technical taxonomy out of public finder URLs.
    const value = values[key].trim();
    if (value) params.set(param, value);
  }
  const query = params.toString();
  return `/unterkuenfte-a-z${query ? `?${query}` : ""}`;
}
