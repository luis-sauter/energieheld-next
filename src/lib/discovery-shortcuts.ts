// Navigation for existing audience slugs, not a list of assigned profile terms.
// Like the theme shortcuts, a link may honestly lead to zero matching results.
export const audienceShortcutPresentation: Record<string, { label: string; icon: string; image: string }> = {
  "mit-hund": { label: "Mit Hund", icon: "mit-hund", image: "/reiseportal/quicklinks/mit-hund.svg" },
  familie: { label: "Mit Kindern", icon: "familienurlaub", image: "/reiseportal/redesign/mottoreisen/familienurlaub.webp" },
  paar: { label: "Zu zweit", icon: "romantik-zu-zweit", image: "/reiseportal/redesign/mottoreisen/romantik-zu-zweit.webp" },
};
export function discoveryAudienceShortcuts() {
  return Object.entries(audienceShortcutPresentation).map(([slug, presentation]) => ({ slug, ...presentation }));
}
