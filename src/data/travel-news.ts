export type TravelNewsItem = {
  id: string;
  title: string;
  teaser: string;
  category: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  dateLabel: 'Veröffentlicht' | 'Aktualisiert';
  checkedAt: string;
  image: string;
  imageAlt: string;
  imageCredit: string;
  featured: boolean;
};

// Manually selected and checked original sources. No runtime feeds or DB reads.
export const travelNews: readonly TravelNewsItem[] = [
  {
    id: 'gastein-thermenherbst',
    title: 'Bergwelt und Thermen im Gasteinertal',
    teaser: 'Erst die Bergwelt entdecken, dann im Thermalwasser entspannen: Gastein verbindet Wanderungen mit einer wohltuenden Auszeit in seinen beiden Thermen.',
    category: 'Wellness & Erholung',
    source: 'Gasteinertal Tourismus',
    sourceUrl: 'https://presse.gastein.com/news-herbstauszeit-im-gasteinertal?id=246527&l=deutsch&menueid=18794',
    publishedAt: '2026-08-18', dateLabel: 'Veröffentlicht', checkedAt: '2026-10-13',
    image: '/reiseportal/news/thermenherbst.webp',
    imageAlt: 'ruhiger Außenpool vor einer Alpenlandschaft, kein konkreter Betrieb.',
    imageCredit: '', featured: true,
  },
  {
    id: 'bayern-herbstcamping',
    title: 'Camping in Bayern: Vorteile der Nebensaison',
    teaser: 'Laut ADAC/PiNCAMP liegen Bayerns Campingpreise in der Nebensaison im Schnitt zehn Prozent unter der Hochsaison.',
    category: 'Camping & Natur', source: 'ADAC Südbayern / PiNCAMP',
    sourceUrl: 'https://presse.adac.de/regionalclubs/suedbayern/herbstcamping-in-bayern-besonders-gefragt.html',
    publishedAt: '2026-09-17', dateLabel: 'Veröffentlicht', checkedAt: '2026-10-13',
    image: '/reiseportal/news/herbstcamping.webp',
    imageAlt: 'Wohnmobil und Campingstühle auf einem gepflegten Stellplatz am See.',
    imageCredit: '', featured: false,
  },
  {
    id: 'zell-gerlos-familienherbst',
    title: 'Familienerlebnisse in Zell-Gerlos',
    teaser: 'Natur entdecken und gemeinsam draußen sein: Zell-Gerlos stellt Ausflugs- und Freizeitideen für Familien vor.',
    category: 'Familie & Aktiv', source: 'Zell-Gerlos · Presse.Tirol',
    sourceUrl: 'https://presse.tirol.at/herbstgenuss-in-zell-gerlos-goldene-momente-im-herzen-des-zillertals/294358/',
    publishedAt: '2026-08-11', dateLabel: 'Aktualisiert', checkedAt: '2026-10-13',
    image: '/reiseportal/news/familienherbst.webp',
    imageAlt: 'Familie auf einem breiten Wanderweg vor einer Berglandschaft.',
    imageCredit: '', featured: false,
  },
];
