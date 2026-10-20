import { destinations, historicalTravelThemes, travelThemes } from "../data/reiseportal-discovery";

// These are the public editorial routes, not advertising-only categories.
export const portalAdSections = [
  {
    id: "mottoreisen",
    label: "Mottoreisen",
    areas: [
      { key: "mottoreisen", label: "Gesamte Rubrik" },
      ...[...new Map([...historicalTravelThemes, ...travelThemes].map(theme => [theme.slug, theme])).values()].map((theme) => ({ key: `mottoreisen/${theme.slug}`, label: theme.title })),
    ],
  },
  {
    id: "reiseziele",
    label: "Reiseziele",
    areas: [
      { key: "reiseziele", label: "Gesamte Rubrik" },
      ...destinations.map((destination) => ({ key: `reiseziele/${destination.slug}`, label: destination.title })),
    ],
  },
] as const;

export type PortalAdSectionId = (typeof portalAdSections)[number]["id"];
export const requestAdScopes = [
  { id: "homepage", name: "Startseite" },
  { id: "mottoreisen", name: "Mottoreisen" },
  { id: "reiseziele", name: "Reiseziele" },
] as const;
export type RequestAdScope = (typeof requestAdScopes)[number]["id"];

// Booking choices are narrower than historical delivery targets.
export function isNewAdTarget(target: { target_type: string; target_key?: string | null }) {
  return target.target_type === "homepage" || target.target_type === "portal_area" && Boolean(portalAdSection(target.target_key ?? ""));
}

export function portalAdSection(key: string): PortalAdSectionId | undefined {
  return portalAdSections.find((section) => section.areas.some((area) => area.key === key))?.id;
}

export function portalAdAreaLabel(key: string): string {
  const section = portalAdSections.find((item) => item.areas.some((area) => area.key === key));
  const area = section?.areas.find((item) => item.key === key);
  if (!section || !area) return "Unbekannter Werbebereich";
  return `${section.label} · ${area.label}`;
}
