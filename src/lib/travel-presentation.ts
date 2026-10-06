import { travelThemes } from "@/data/reiseportal-discovery";

// Presentation only: internal keys and database labels remain unchanged.
export const audiencePresentation: Record<string, { label: string; icon: string }> = {
  "mit-hund": { label: "Mit Hund", icon: "mit-hund" },
  familie: { label: "Mit Kindern", icon: "familienurlaub" },
  paar: { label: "Zu zweit", icon: "romantik-zu-zweit" },
};
const signals = [
  ...Object.entries(audiencePresentation).map(([slug, value]) => ({ key: `audience:${slug}`, ...value })),
  ...travelThemes.map(theme => ({ key: `theme:${theme.slug}`, label: theme.title, icon: theme.slug })),
];
export function publicTravelLabel(key: string, fallback: string) {
  return signals.find(signal => signal.key === key)?.label ?? fallback;
}
export function profileTravelSignals(keys: readonly string[] = [], limit = 4) {
  const assigned = new Set(keys);
  return signals.filter(signal => assigned.has(signal.key)).slice(0, limit);
}
