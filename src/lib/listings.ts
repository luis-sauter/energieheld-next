import type { Listing } from "@/types/portal";

export type ListingFilters = {
  query: string;
  category: string;
  location: string;
  service: string;
  sort: string;
};
const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");

export function filterListings(
  items: Listing[],
  filters: ListingFilters,
): Listing[] {
  const words = normalize(filters.query).split(/\s+/).filter(Boolean);
  const result = items.filter((item) => {
    const haystack = normalize(
      [
        item.name,
        item.tagline,
        item.description,
        item.businessAreas,
        item.location.city,
        ...item.services,
      ].join(" "),
    );
    return (
      words.every((word) => haystack.includes(word)) &&
      (!filters.category || item.categoryIds.includes(filters.category)) &&
      (!filters.location ||
        normalize(
          `${item.location.city} ${item.location.postalCode} ${item.location.region}`,
        ).includes(normalize(filters.location))) &&
      (!filters.service || item.services.includes(filters.service))
    );
  });
  if (filters.sort === "name")
    result.sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (filters.sort === "city")
    result.sort((a, b) => a.location.city.localeCompare(b.location.city, "de"));
  return result;
}

export function formatLocation(location: Listing["location"]): string {
  return [
    [location.postalCode, location.city].filter(Boolean).join(" "),
    location.region,
    location.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export function googleMapsLocation(location: Listing["location"]) {
  const city = location.city.trim();
  const postalCode = location.postalCode.trim();
  const region = location.region.trim();
  const country = location.country.trim();
  const street = location.street?.trim() ?? "";
  // A country/region alone is not a useful company location.
  if (!(city && (postalCode || region || country)) && !(postalCode && country))
    return null;
  const precise = Boolean(street && /\d/.test(street) && postalCode && city);
  const query = [
    precise ? street : "",
    [postalCode, city].filter(Boolean).join(" "),
    region,
    country,
  ]
    .filter(Boolean)
    .join(", ");
  const encoded = encodeURIComponent(query);
  return {
    query,
    precise,
    embedUrl: `https://www.google.com/maps?q=${encoded}&z=${precise ? 16 : 12}&output=embed`,
    searchUrl: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  };
}
