// Editorial navigation only; these groups do not assign profiles or create taxonomy.
export const mottoGroups = [
  { id: "alle", label: "Alle Themen", icon: "wanderurlaub" },
  { id: "aktiv", label: "Aktiv", icon: "radwandern" },
  { id: "erholung", label: "Erholung", icon: "wellnessangebote" },
  { id: "familie", label: "Familie", icon: "familienurlaub" },
  { id: "wasser", label: "Wasser", icon: "urlaub-am-wasser" },
  { id: "natur", label: "Natur", icon: "natur-pur" },
  { id: "genuss", label: "Kultur & Genuss", icon: "romantik-zu-zweit" },
  { id: "business", label: "Business", icon: "geschaeftsreisen" },
] as const;
export type MottoGroup = typeof mottoGroups[number]["id"];
export const mottoPresentation: Record<string, { groups: MottoGroup[]; alt: string }> = {
  "natur-pur": { groups: ["natur"], alt: "Blumenwiese, Wald und weite Alpenlandschaft" },
  "nordic-walking": { groups: ["aktiv", "natur"], alt: "Nordic Walker mit Stöcken auf einem Bergweg" },
  radwandern: { groups: ["aktiv", "natur"], alt: "Radfahrer auf einem sonnigen Weg am See" },
  wanderurlaub: { groups: ["aktiv", "natur"], alt: "Wandernde auf einem alpinen Pfad" },
  familienurlaub: { groups: ["familie"], alt: "Familie beim gemeinsamen Urlaub am Wasser" },
  golfurlaub: { groups: ["aktiv"], alt: "Golfspieler auf einem sonnigen Platz im Grünen" },
  tauchurlaub: { groups: ["aktiv", "wasser"], alt: "Taucher in klarem blauem Wasser" },
  "urlaub-am-wasser": { groups: ["wasser", "erholung"], alt: "Sonnige Bucht mit türkisfarbenem Wasser" },
  campingurlaub: { groups: ["natur", "familie"], alt: "Campervan am See in der Natur" },
  "romantik-zu-zweit": { groups: ["genuss", "erholung"], alt: "Paar in warmer Abendstimmung am See" },
  wellnessangebote: { groups: ["erholung"], alt: "Entspannen im Pool mit Bergblick" },
  geschaeftsreisen: { groups: ["business"], alt: "Geschäftsreisender in einer hellen Flughafenlounge" },
};
export function mottoGroup(value?: string): MottoGroup {
  return mottoGroups.some(group => group.id === value) ? value as MottoGroup : "alle";
}
