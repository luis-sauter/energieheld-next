// Labels are the existing Joomla tags (IDs 5–20). Images are selected from
// provider-matched originals in .legacy-reiseportal/media/companies.
// Intros below come from the existing portal live homepage and destination
// overview (https://das-reiseportal.com/); no new
// destination or travel taxonomy is inferred from Supabase profiles.
export type DiscoveryEntry = {
  title: string;
  slug: string;
  image: string;
  alt: string;
  intro: string;
  previewSlugs: readonly string[];
};

const destinationIntro = "Der deutschsprachige Raum bietet eine Vielzahl von faszinierenden Reisezielen, die sich hervorragend für Ihren Urlaub eignen.";
const mottoIntro = "Mottoreisen bieten eine hervorragende Möglichkeit, Reisen auf eine neue, faszinierende Art zu erleben.";

export const destinations: readonly DiscoveryEntry[] = [
  { title: "Deutschland", slug: "deutschland", image: "/reiseportal/destinations/deutschland.jpg", alt: "Familie auf einer Radtour im Bayerischen Wald", intro: "Deutschland bietet eine breite Palette an Unterkunftsmöglichkeiten für verschiedene Bedürfnisse und Budgets.", previewSlugs: ["bayerischer-wald"] },
  { title: "Österreich", slug: "oesterreich", image: "/reiseportal/destinations/oesterreich.jpg", alt: "Bergsee bei Maria Alm in Österreich", intro: destinationIntro, previewSlugs: ["hoeflehner", "schafhuber"] },
  { title: "Schweiz", slug: "schweiz", image: "/reiseportal/destinations/schweiz.jpg", alt: "Blausee in der Schweiz", intro: destinationIntro, previewSlugs: [] },
  { title: "Südtirol/Italien", slug: "suedtirol-italien", image: "/reiseportal/destinations/suedtirol-italien.jpg", alt: "Landschaft bei der Pension Sonnenhof in Südtirol", intro: destinationIntro, previewSlugs: ["pension-sonnenhof", "villner-hof"] },
];

// Provider matches below are the business_category_raw values in normalized/companies.json.
export const travelThemes: readonly DiscoveryEntry[] = [
  { title: "Natur pur", slug: "natur-pur", image: "/reiseportal/mottoreisen/natur-pur.jpg", alt: "Luchse im Nationalpark Bayerischer Wald", intro: mottoIntro, previewSlugs: ["bayerischer-wald", "villner-hof"] },
  { title: "Nordic Walking", slug: "nordic-walking", image: "/reiseportal/mottoreisen/nordic-walking.jpg", alt: "Wanderpause in den Bergen bei Maria Alm", intro: mottoIntro, previewSlugs: ["bayerischer-wald", "hoeflehner", "pension-sonnenhof", "schafhuber", "villner-hof"] },
  { title: "Radwandern", slug: "radwandern", image: "/reiseportal/mottoreisen/radwandern.jpg", alt: "Familie auf einer Radtour im Bayerischen Wald", intro: mottoIntro, previewSlugs: ["pension-sonnenhof", "villner-hof"] },
  { title: "Wanderurlaub", slug: "wanderurlaub", image: "/reiseportal/mottoreisen/wanderurlaub.jpg", alt: "Wanderer beim Höflehner", intro: mottoIntro, previewSlugs: ["bayerischer-wald", "hoeflehner", "schafhuber", "villner-hof"] },
  { title: "Familienurlaub", slug: "familienurlaub", image: "/reiseportal/mottoreisen/familienurlaub.jpg", alt: "Kinder beim Hotel Salzburger Hof", intro: mottoIntro, previewSlugs: ["hoeflehner"] },
  { title: "Golfurlaub", slug: "golfurlaub", image: "/reiseportal/mottoreisen/golfurlaub.jpg", alt: "Golfplatz des Golfhotels Andreus in Südtirol", intro: mottoIntro, previewSlugs: [] },
  { title: "Tauchurlaub", slug: "tauchurlaub", image: "/reiseportal/mottoreisen/tauchurlaub.jpg", alt: "Tauchmotiv von SUB Aqua Tauchreisen", intro: mottoIntro, previewSlugs: [] },
  { title: "Urlaub am Wasser", slug: "urlaub-am-wasser", image: "/reiseportal/mottoreisen/urlaub-am-wasser.jpg", alt: "Blausee in der Schweiz", intro: mottoIntro, previewSlugs: [] },
  { title: "Campingurlaub", slug: "campingurlaub", image: "/reiseportal/mottoreisen/campingurlaub.jpg", alt: "Campingmotiv vom Wirthshof", intro: mottoIntro, previewSlugs: [] },
  { title: "Romantik zu zweit", slug: "romantik-zu-zweit", image: "/reiseportal/mottoreisen/romantik-zu-zweit.jpg", alt: "Annis Romantikhäuschen", intro: mottoIntro, previewSlugs: [] },
  { title: "Wellnessangebote", slug: "wellnessangebote", image: "/reiseportal/mottoreisen/wellnessangebote.jpg", alt: "Wellnessbereich beim Höflehner", intro: mottoIntro, previewSlugs: ["hoeflehner"] },
  { title: "Geschäftsreisen", slug: "geschaeftsreisen", image: "/reiseportal/mottoreisen/geschaeftsreisen.jpg", alt: "The Chedi in der Schweiz", intro: mottoIntro, previewSlugs: [] },
];
