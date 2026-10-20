// Labels are Joomla tags (IDs 5–20). Mottoreisen images are the exact published
// banners 172–183 in normalized/banner-inventory.csv; their originals are in
// public/reiseportal/mottoreisen. Theme copy quotes the indicated published
// Joomla article, not a fabricated category description (tag descriptions are empty).
export type DiscoveryEntry = {
  title: string;
  slug: string;
  image: string | null;
  alt: string;
  intro: string;
  stayHeading?: string;
  seoTitle?: string;
  seoDescription?: string;
  previewSlugs: readonly string[];
};

export const destinations: readonly DiscoveryEntry[] = [
  { title: "Deutschland", slug: "deutschland", image: "/reiseportal/destinations/deutschland.jpg", alt: "Familie auf einer Radtour im Bayerischen Wald", intro: "Wind an der Küste, ein Radweg am Fluss, Waldpfade vor den Alpen: Deutschland lässt sich aus vielen Blickwinkeln entdecken. Zwischen kleinen Orten und lebendigen Städten liegen Reiseziele für ein freies Wochenende genauso wie für längere Urlaubstage. Lernen Sie Gastgeber kennen und finden Sie Ihren Ausgangspunkt für die Region, die Sie neugierig macht.", stayHeading: "Gastgeber zwischen Küste und Alpen", seoTitle: "Deutschland – Urlaub zwischen Küste und Alpen", seoDescription: "Reiseziele in Deutschland: Entdecken Sie Küsten, Flusstäler und Bergregionen sowie passende Unterkünfte für Ihre nächste Auszeit.", previewSlugs: ["bayerischer-wald"] },
  { title: "Österreich", slug: "oesterreich", image: "/reiseportal/destinations/oesterreich.jpg", alt: "Bergsee bei Maria Alm in Österreich", intro: "In Österreich führen die Wege vom Seeufer hinauf auf die Alm und manchmal direkt in die nächste Kaffeehauspause. Das Salzkammergut, die Alpentäler und die Städte geben einer Reise ganz unterschiedliche Rhythmen. Wählen Sie einen Gastgeber als Ausgangspunkt für Tage draußen, kulturelle Entdeckungen oder eine ruhige Auszeit.", stayHeading: "Gastgeber für Berg- und Seetage", seoTitle: "Österreich – Urlaub zwischen Bergen und Seen", seoDescription: "Österreich entdecken: Alpentäler, Seenlandschaften und Städte kennenlernen. Finden Sie passende Gastgeber für Ihre Urlaubspläne.", previewSlugs: ["hoeflehner", "schafhuber"] },
  { title: "Schweiz", slug: "schweiz", image: "/reiseportal/destinations/schweiz.jpg", alt: "Blausee in der Schweiz", intro: "Ein See unter steilen Berghängen, ein Weg durch ein Bergdorf, eine Pause auf einer Tessiner Piazza: Die Schweiz eröffnet auf kleinem Raum sehr unterschiedliche Perspektiven. Zwischen Alpen und Seeufern lohnt es sich, einem Ort mehr Zeit zu geben. Entdecken Sie Gastgeber und vergleichen Sie ihre Lage mit den Wegen und Ausflügen, die Sie planen.", stayHeading: "Ihre Auszeit in der Schweiz", seoTitle: "Schweiz – Reiseziele an Seen und in den Alpen", seoDescription: "Reiseziele in der Schweiz: Alpenlandschaften, Seeufer und das Tessin entdecken. Lernen Sie passende Unterkünfte und Gastgeber kennen.", previewSlugs: [] },
  { title: "Südtirol/Italien", slug: "suedtirol-italien", image: "/reiseportal/destinations/suedtirol-italien.jpg", alt: "Landschaft bei der Pension Sonnenhof in Südtirol", intro: "In Südtirol liegen alpine Wege und südliches Lebensgefühl nah beieinander. Dolomitengipfel, Weinberge und die Orte entlang der Täler laden zu unterschiedlichen Entdeckungen ein; weiter südlich öffnen die Seen Norditaliens neue Reisewege. Finden Sie einen Gastgeber für Ihre Pläne und verbinden Sie Tage in der Landschaft mit Zeit für die Region.", stayHeading: "Gastgeber zwischen Alpen und Süden", seoTitle: "Südtirol/Italien – Dolomiten und südliche Reiseideen", seoDescription: "Südtirol und Italien entdecken: Dolomiten, Weinberge und Seen Norditaliens. Finden Sie passende Unterkünfte für Ihre Reise.", previewSlugs: ["pension-sonnenhof", "villner-hof"] },
];

// Preview matches are published Joomla tags from raw/articles.json.
export const historicalTravelThemes: readonly DiscoveryEntry[] = [
  { title: "Natur pur", slug: "natur-pur", image: "/reiseportal/mottoreisen/natur-pur.jpg", alt: "Originales Joomla-Banner Natur pur", intro: "Endlose Wiesen, grüne Wälder und Natur soweit das Auge reicht.", previewSlugs: ["bayerischer-wald", "villner-hof"] }, // article 443
  { title: "Nordic Walking", slug: "nordic-walking", image: "/reiseportal/mottoreisen/nordic-walking.jpg", alt: "Originales Joomla-Banner Nordic Walking", intro: "Das Hochplateau von Meransen ist ein Paradies für Nordic Walking Fans und die Pension Sonnenhof ist der ideale Standort, um zu erlebnisreichen Touren durch reizvolle Naturlandschaften aufzubrechen.", previewSlugs: ["bayerischer-wald", "hoeflehner", "pension-sonnenhof", "schafhuber", "villner-hof"] }, // article 470
  { title: "Radwandern", slug: "radwandern", image: "/reiseportal/mottoreisen/radwandern.jpg", alt: "Originales Joomla-Banner Radwandern", intro: "Radtouren sind die ideale Methode, die Sächsische Schweiz ausgiebig zu erkunden.", previewSlugs: ["pension-sonnenhof", "villner-hof"] }, // article 462
  { title: "Wanderurlaub", slug: "wanderurlaub", image: "/reiseportal/mottoreisen/wanderurlaub.jpg", alt: "Originales Joomla-Banner Wanderurlaub", intro: "Wanderurlaub mit der ganzen Familie in Dienten im Salzburger Land in der Hochkönig-Region.", previewSlugs: ["bayerischer-wald", "hoeflehner", "schafhuber", "villner-hof", "anni-romantikhaeuschen"] }, // article 503
  { title: "Familienurlaub", slug: "familienurlaub", image: "/reiseportal/mottoreisen/familienurlaub.jpg", alt: "Originales Joomla-Banner Familienurlaub", intro: "Urlaub mit der ganzen Familie in Dienten am Hochkönig - Familienhotel im Salzburger Land", previewSlugs: ["hoeflehner"] }, // article 502
  { title: "Golfurlaub", slug: "golfurlaub", image: "/reiseportal/mottoreisen/golfurlaub.jpg", alt: "Originales Joomla-Banner Golfurlaub", intro: "Golf in Südtirol auf der Sonnenseite der Alpen. Das Golf & Spa Resort Hotel Andreus liegt direkt am traumhaft gelegenen 18-Loch Golfplatz Passeier.", previewSlugs: ["golfhotel-andreus"] }, // article 452
  { title: "Tauchurlaub", slug: "tauchurlaub", image: "/reiseportal/mottoreisen/tauchurlaub.jpg", alt: "Originales Joomla-Banner Tauchurlaub", intro: "Tauchreisen, Tauchsafaris und Abenteuerurlaube weltweit!", previewSlugs: ["wirodive-tauchreisen"] }, // article 458
  { title: "Urlaub am Wasser", slug: "urlaub-am-wasser", image: "/reiseportal/mottoreisen/urlaub-am-wasser.jpg", alt: "Originales Joomla-Banner Urlaub am Wasser", intro: "Ferien, Spass & Urlaub an der Ostsee! Zu jeder Jahreszeit – Frühling, Sommer, Herbst & Winter.", previewSlugs: ["wirthshof"] }, // article 449
  { title: "Campingurlaub", slug: "campingurlaub", image: "/reiseportal/mottoreisen/campingurlaub.jpg", alt: "Originales Joomla-Banner Campingurlaub", intro: "Im Urlaub einen Gang herunterschalten und genau das tun, was ich will – das ist Bodensee-Camping bei uns auf dem Wirthshof.", previewSlugs: ["wirthshof"] }, // article 468
  { title: "Romantik zu zweit", slug: "romantik-zu-zweit", image: "/reiseportal/mottoreisen/romantik-zu-zweit.jpg", alt: "Originales Joomla-Banner Romantik zu zweit", intro: "Romantik - Kurzreisen als Kuschelwochenende zählt zu den besonderen Erlebnissen für Verliebte!", previewSlugs: ["anni-romantikhaeuschen"] }, // article 450
  { title: "Wellnessangebote", slug: "wellnessangebote", image: "/reiseportal/mottoreisen/wellnessangebote.jpg", alt: "Originales Joomla-Banner Wellnessangebote", intro: "Wellnessglück. Aktivitäten und süßes Nichtstun perfekt kombiniert: Willkommen im Wellnesshotel Naturns, Südtirol.", previewSlugs: ["hoeflehner", "golfhotel-andreus"] }, // article 460
  { title: "Geschäftsreisen", slug: "geschaeftsreisen", image: "/reiseportal/mottoreisen/geschaeftsreisen.jpg", alt: "Originales Joomla-Banner Geschäftsreisen", intro: "In unserem Tagungshotel in Bayern gibt es drei helle Tagungsräume mit Platz für insgesamt bis zu 95 Personen und modernster technischer Ausstattung.", previewSlugs: ["hotel-zur-post"] }, // article 457
];
// Retain historical targeting keys and source media; the retired rubric has
// no public route, navigation, finder option, sitemap or related-page link.
export const travelThemes: readonly DiscoveryEntry[] = [
  ...historicalTravelThemes.filter(entry => entry.slug !== 'tauchurlaub'),
  { title: 'Skiurlaub', slug: 'skifahren', image: '/reiseportal/motto-editorial-v2/skifahren.webp', alt: 'KI-Symbolbild: Skipiste vor verschneiten Alpengipfeln', intro: 'Wintertage auf der Piste und Gastgeber mit belegtem Skiangebot entdecken.', previewSlugs: [] },
];
