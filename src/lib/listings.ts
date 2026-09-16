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
      [item.name, item.tagline, item.location.city, ...item.services].join(" "),
    );
    return (
      words.every((word) => haystack.includes(word)) &&
      (!filters.category || item.categoryIds.includes(filters.category)) &&
      (!filters.location ||
        normalize(`${item.location.city} ${item.location.postalCode}`).includes(
          normalize(filters.location),
        )) &&
      (!filters.service || item.services.includes(filters.service))
    );
  });
  if (filters.sort === "name")
    result.sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (filters.sort === "city")
    result.sort((a, b) => a.location.city.localeCompare(b.location.city, "de"));
  return result;
}
