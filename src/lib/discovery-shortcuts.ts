import { audiencePresentation } from "./travel-presentation";
import { travelThemes } from "@/data/reiseportal-discovery";

// Public routes use the same catalog as /mottoreisen/[slug], never UI labels.
const audienceThemeRoutes: Readonly<Record<string, string>> = { paar: "romantik-zu-zweit" };
export function discoveryShortcutHref(dimension: "theme" | "audience", slug: string) {
  const themeSlug = dimension === "theme" ? slug : audienceThemeRoutes[slug];
  if (travelThemes.some(theme => theme.slug === themeSlug)) return `/mottoreisen/${themeSlug}`;
  return `/unterkuenfte-a-z?${dimension === "theme" ? "thema" : "zielgruppe"}=${encodeURIComponent(slug)}`;
}

// Navigation for existing audience slugs, not a list of assigned profile terms.
// Like the theme shortcuts, a link may honestly lead to zero matching results.
export const audienceShortcutPresentation: Record<string, { label: string; icon: string; image: string }> = {
  "mit-hund": { ...audiencePresentation["mit-hund"], image: "/reiseportal/quicklinks/mit-hund.webp" },
  familie: { ...audiencePresentation.familie, image: "/reiseportal/redesign/mottoreisen/familienurlaub.webp" },
  paar: { ...audiencePresentation.paar, image: "/reiseportal/redesign/mottoreisen/romantik-zu-zweit.webp" },
};
export function discoveryAudienceShortcuts() {
  return Object.entries(audienceShortcutPresentation).map(([slug, presentation]) => ({ slug, ...presentation }));
}
