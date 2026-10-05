import type { PublicTravelTerm } from "./reiseportal-filter-options";

// Presentation only: existing public audience terms, no assignments or new taxonomy.
export const audienceShortcutPresentation: Record<string, { icon: string; image?: string }> = {
  familie: { icon: "familienurlaub", image: "/reiseportal/redesign/mottoreisen/familienurlaub.webp" },
  paar: { icon: "romantik-zu-zweit", image: "/reiseportal/redesign/mottoreisen/romantik-zu-zweit.webp" },
  "mit-hund": { icon: "mit-hund" }, // No matching dog asset exists; do not substitute an unrelated photo.
};
export function discoveryAudienceShortcuts(terms: PublicTravelTerm[]) {
  return terms.filter(term => term.dimension === "audience" && audienceShortcutPresentation[term.slug])
    .map(term => ({ slug: term.slug, label: term.label, ...audienceShortcutPresentation[term.slug] }));
}
