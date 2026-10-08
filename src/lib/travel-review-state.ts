import type { TravelTerm } from "./admin-travel-taxonomy";
import { audiencePresentation, publicTravelLabel } from "./travel-presentation";

export function travelTermIcon(term: TravelTerm) {
  const slug = term.term_key.split(":")[1];
  return term.dimension === "audience" ? audiencePresentation[slug]?.icon ?? "unterkunft" : term.dimension === "theme" ? slug : "unterkunft";
}
export function sameTravelKeys(a: readonly string[], b: readonly string[]) {
  const left = new Set(a), right = new Set(b);
  return left.size === right.size && [...left].every(key => right.has(key));
}
export function travelFilterPreview(terms: TravelTerm[], keys: readonly string[]) {
  const params = { theme: "thema", audience: "zielgruppe", accommodation: "unterkunftstyp" };
  return terms.filter(term => keys.includes(term.term_key)).map(term => {
    const parameter = term.dimension === "feature" ? null : params[term.dimension];
    return { ...term, label: publicTravelLabel(term.term_key, term.label), href: parameter ? `/unterkuenfte-a-z?${new URLSearchParams({ [parameter]: term.term_key.split(":")[1] })}` : null };
  });
}
