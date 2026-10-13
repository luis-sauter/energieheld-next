export const travelSeasons = [
  { slug: "saison-fruehling", label: "Frühling", image: "/reiseportal/motto-editorial-v2/natur-pur.webp", alt: "Grüne Wiesen und Wald im Frühling", intro: "Neue Energie für Wege durch die Natur und entspannte Tage draußen." },
  { slug: "saison-sommer", label: "Sommer", image: "/reiseportal/motto-editorial-v2/urlaub-am-wasser.webp", alt: "Sommerliche Landschaft am Wasser", intro: "Zeit für Seeufer, Camping und aktive Urlaubstage unter freiem Himmel." },
  { slug: "saison-herbst", label: "Herbst", image: "/reiseportal/motto-editorial-v2/radwandern.webp", alt: "Flusslandschaft und Weinberge im Herbst", intro: "Ruhige Naturmomente, Bewegung und wohltuende Auszeiten." },
  { slug: "saison-winter", label: "Winter", image: "/reiseportal/mottoreisen/wellnessangebote.jpg", alt: "Ruhiger Wellnessbereich für eine Auszeit in der kalten Jahreszeit", intro: "Belegte Winterangebote und entspannte Rückzugsorte für kalte Tage." },
] as const;

export function travelSeason(slug: string) { return travelSeasons.find(season => season.slug === slug); }
export function isSeasonTerm(key: string) { return travelSeasons.some(season => key === `theme:${season.slug}`); }
export function currentTravelSeason(date = new Date()) {
  const month = Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Berlin", month: "numeric" }).format(date));
  return travelSeasons[month >= 3 && month <= 5 ? 0 : month >= 6 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : 3];
}
export function orderedTravelSeasons(date = new Date()) {
  const current = currentTravelSeason(date);
  return [current, ...travelSeasons.filter(season => season !== current)];
}
export type SeasonTeasers = Record<string, string>;
export function validSeasonTeasers(value: unknown): value is SeasonTeasers {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([key, text]) => isSeasonTerm(key) && typeof text === "string" && text.length <= 240));
}
