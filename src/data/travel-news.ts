export type TravelNewsItem = {
  id: string;
  title: string;
  teaser: string;
  category: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  dateLabel: 'Veröffentlicht' | 'Aktualisiert' | 'Stand';
  checkedAt: string;
  image: string;
  imageAlt: string;
  imageCredit: string;
  imagePosition?: string;
  featured: boolean;
};

// Manually selected and checked original sources. No runtime feeds or DB reads.
export const travelNews: readonly TravelNewsItem[] = [
  {
    id: 'tirol-winteranreise-2026',
    title: 'Mit der Bahn in den Tiroler Winter',
    teaser: 'Neue Direktverbindungen und zusätzliche Nachtzugangebote erweitern die Winteranreise 2026/27 nach Tirol. Entdecken Sie die Verbindungen und planen Sie Ihre Auszeit in den Bergen.',
    category: 'Winter & Anreise',
    source: 'Tirol Werbung · Presse.Tirol',
    sourceUrl: 'https://presse.tirol.at/anreiseneuigkeiten-winter-2026-27/299467/',
    publishedAt: '2026-10-20', dateLabel: 'Aktualisiert', checkedAt: '2026-11-11',
    image: '/reiseportal/news/winterbahn-2026.webp',
    imageAlt: 'KI-Symbolbild: Personenzug in einer verschneiten Alpenlandschaft, kein konkreter Ort oder Zugdienst.',
    imageCredit: 'KI-generiertes Symbolbild', imagePosition: '70% center', featured: true,
  },
  {
    id: 'bayern-wintercamping-2026',
    title: 'Wintercamping: Bayern neu entdecken',
    teaser: 'Entdecken Sie Plätze und Ideen für Ihren Winterurlaub.',
    category: 'Camping & Natur', source: 'ADAC Südbayern',
    sourceUrl: 'https://www.adac.de/der-adac/regionalclubs/suedbayern/news/wintercamping-bayern-beste-campingplaetze/',
    publishedAt: '2026-10-27', dateLabel: 'Veröffentlicht', checkedAt: '2026-11-11',
    image: '/reiseportal/news/wintercamping-2026.webp',
    imageAlt: 'KI-Symbolbild: Wohnmobil auf einem winterlichen Stellplatz am Wald, kein konkreter Campingbetrieb.',
    imageCredit: 'KI-generiertes Symbolbild', featured: false,
  },
  {
    id: 'schweiz-advent-2026',
    title: 'Adventszeit in der Schweiz planen',
    teaser: 'Die Weihnachtsmärkte 2026 mit Orten und Terminen.',
    category: 'Städte & Advent', source: 'Schweiz Tourismus',
    sourceUrl: 'https://www.myswitzerland.com/de-de/erlebnisse/veranstaltungen/veranstaltungen-suche/?rubrik=advents-undweihnachtsmaerkte',
    publishedAt: '2026-11-11', dateLabel: 'Stand', checkedAt: '2026-11-11',
    image: '/reiseportal/news/advent-schweiz-2026.webp',
    imageAlt: 'KI-Symbolbild: festlich beleuchteter Adventsmarkt in einer schweizerisch anmutenden Altstadt, kein konkreter Veranstaltungsort.',
    imageCredit: 'KI-generiertes Symbolbild', featured: false,
  },
];
