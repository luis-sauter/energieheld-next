import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import type { Listing } from "@/types/portal";

const countryNames: Record<string, readonly string[]> = {
  deutschland: ["Deutschland", "Germany", "DE"],
  oesterreich: ["Österreich", "Austria", "AT"],
  schweiz: ["Schweiz", "Switzerland", "CH"],
  "suedtirol-italien": ["Italien", "Italy", "IT"],
};

export function filterTravelDiscovery(
  items: Listing[], destination: string, theme: string,
  audience = "", accommodation = "", feature = "",
) {
  const selectedDestination = destinations.find((entry) => entry.slug === destination);
  const selectedTheme = travelThemes.find((entry) => entry.slug === theme);
  return items.filter((listing) => {
    const hasTerm = (dimension: string, slug: string) =>
      !slug || listing.travelTermKeys?.includes(`${dimension}:${slug}`) === true;
    return (!destination || (selectedDestination && countryNames[destination]?.includes(listing.location.country))) &&
      (!theme || (selectedTheme && (listing.travelTermKeys
        ? hasTerm("theme", theme)
        : selectedTheme.previewSlugs.includes(listing.slug)))) &&
      hasTerm("audience", audience) && hasTerm("accommodation", accommodation) &&
      hasTerm("feature", feature);
  });
}
