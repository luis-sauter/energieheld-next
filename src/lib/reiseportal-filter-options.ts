import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import type { Listing } from "@/types/portal";

export type PublicTravelTerm = {
  term_key: string;
  dimension: "theme" | "audience" | "accommodation" | "feature";
  slug: string;
  label: string;
};

type Option = { slug: string; label: string };

export function availableTravelFilters(listings: Listing[], terms: PublicTravelTerm[]) {
  const assigned = new Set(listings.flatMap((listing) => listing.travelTermKeys ?? []));
  const options = (dimension: PublicTravelTerm["dimension"]): Option[] => terms
    .filter((term) => term.dimension === dimension && assigned.has(term.term_key))
    .map(({ slug, label }) => ({ slug, label }));
  return {
    themes: travelThemes.filter((entry) => assigned.has(`theme:${entry.slug}`))
      .map(({ slug, title }) => ({ slug, label: title })),
    audiences: options("audience"),
    accommodations: options("accommodation"),
    features: options("feature"),
  };
}

export type TravelFilterValues = {
  destination: string;
  theme: string;
  audience: string;
  accommodation: string;
  feature: string;
  query: string;
  location: string;
  sort: string;
};

export function readTravelFilterValues(params: Record<string, string | string[] | undefined>): TravelFilterValues {
  const read = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  return {
    destination: read("ziel"), theme: read("thema"), audience: read("zielgruppe"),
    accommodation: read("unterkunftstyp"), feature: read("besonderheit"),
    query: read("q"), location: read("ort"), sort: read("sort"),
  };
}

export function activeTravelFilterLabels(
  values: TravelFilterValues,
  options: ReturnType<typeof availableTravelFilters>,
) {
  const selected = (value: string, choices: Option[], fallback: string) =>
    choices.find((option) => option.slug === value)?.label ?? fallback;
  const active: string[] = [];
  if (values.destination) active.push(`Reiseziel: ${selected(values.destination,
    destinations.map(({ slug, title }) => ({ slug, label: title })), "Nicht verfügbar")}`);
  if (values.theme) active.push(`Reiseart: ${selected(values.theme, options.themes, "Nicht verfügbar")}`);
  if (values.audience) active.push(`Mit wem: ${selected(values.audience, options.audiences, "Nicht verfügbar")}`);
  if (values.accommodation) active.push(`Unterkunft: ${selected(values.accommodation, options.accommodations, "Nicht verfügbar")}`);
  if (values.feature) active.push(`Besonderheit: ${selected(values.feature, options.features, "Nicht verfügbar")}`);
  if (values.query) active.push(`Suche: ${values.query}`);
  if (values.location) active.push(`Ort/PLZ: ${values.location}`);
  if (values.sort) active.push(`Sortierung: ${values.sort === "name" ? "Name A–Z"
    : values.sort === "city" ? "Standort A–Z" : "Standard"}`);
  return active;
}
