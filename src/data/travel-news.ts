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
    title: 'Thermenherbst im Gasteinertal',
    teaser: 'Erst die Bergwelt entdecken, dann im Thermalwasser entspannen: Gastein verbindet herbstliche Wanderungen mit einer wohltuenden Auszeit in seinen beiden Thermen.',
    category: 'Wellness & Erholung',
    source: 'Gasteinertal Tourismus',
    sourceUrl: 'https://presse.gastein.com/news-herbstauszeit-im-gasteinertal?id=246527&l=deutsch&menueid=18794',
    publishedAt: '2026-08-18', dateLabel: 'Veröffentlicht', checkedAt: '2026-10-13',
    image: '/reiseportal/news/thermenherbst.webp',
    imageAlt: 'KI-Symbolbild: ruhiger Außenpool vor einer herbstlichen Alpenlandschaft, kein konkreter Betrieb.',
    imageCredit: 'KI-generiertes Symbolbild', featured: true,
  },
  {
    id: 'bayern-herbstcamping',
    title: 'Herbstcamping in Bayern',
    teaser: 'Laut ADAC/PiNCAMP liegen Bayerns Campingpreise in der Nebensaison im Schnitt zehn Prozent unter der Hochsaison.',
    category: 'Camping & Natur', source: 'ADAC Südbayern / PiNCAMP',
    sourceUrl: 'https://presse.adac.de/regionalclubs/suedbayern/herbstcamping-in-bayern-besonders-gefragt.html',
    publishedAt: '2026-09-17', dateLabel: 'Veröffentlicht', checkedAt: '2026-10-13',
    image: '/reiseportal/news/herbstcamping.webp',
    imageAlt: 'KI-Symbolbild: Wohnmobil und Campingstühle auf einem gepflegten Stellplatz an einem herbstlichen See.',
    imageCredit: 'KI-generiertes Symbolbild', featured: false,
  },
  {
    id: 'zell-gerlos-familienherbst',
    title: 'Familienherbst in Zell-Gerlos',
    teaser: 'Natur entdecken und gemeinsam draußen sein: Zell-Gerlos stellt herbstliche Ausflugs- und Freizeitideen für Familien vor.',
    category: 'Familie & Aktiv', source: 'Zell-Gerlos · Presse.Tirol',
    sourceUrl: 'https://presse.tirol.at/herbstgenuss-in-zell-gerlos-goldene-momente-im-herzen-des-zillertals/294358/',
    publishedAt: '2026-08-11', dateLabel: 'Aktualisiert', checkedAt: '2026-10-13',
    image: '/reiseportal/news/familienherbst.webp',
    imageAlt: 'KI-Symbolbild: Familie auf einem breiten Wanderweg vor einer herbstlichen Berglandschaft.',
    imageCredit: 'KI-generiertes Symbolbild', featured: false,
  },
];
