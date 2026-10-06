import { audiencePresentation } from "./travel-presentation";

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
