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
  previewSlugs: readonly string[];
};

const destinationIntro = "Der deutschsprachige Raum bietet eine Vielzahl von faszinierenden Reisezielen, die sich hervorragend für Ihren Urlaub eignen.";

export const destinations: readonly DiscoveryEntry[] = [
  { title: "Deutschland", slug: "deutschland", image: "/reiseportal/destinations/deutschland.jpg", alt: "Familie auf einer Radtour im Bayerischen Wald", intro: "Deutschland bietet eine breite Palette an Unterkunftsmöglichkeiten für verschiedene Bedürfnisse und Budgets.", previewSlugs: ["bayerischer-wald"] },
  { title: "Österreich", slug: "oesterreich", image: "/reiseportal/destinations/oesterreich.jpg", alt: "Bergsee bei Maria Alm in Österreich", intro: destinationIntro, previewSlugs: ["hoeflehner", "schafhuber"] },
  { title: "Schweiz", slug: "schweiz", image: "/reiseportal/destinations/schweiz.jpg", alt: "Blausee in der Schweiz", intro: destinationIntro, previewSlugs: [] },
  { title: "Südtirol/Italien", slug: "suedtirol-italien", image: "/reiseportal/destinations/suedtirol-italien.jpg", alt: "Landschaft bei der Pension Sonnenhof in Südtirol", intro: destinationIntro, previewSlugs: ["pension-sonnenhof", "villner-hof"] },
];

// Preview matches are published Joomla tags from raw/articles.json.
export const travelThemes: readonly DiscoveryEntry[] = [
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
