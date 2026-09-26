import type { Listing } from "@/types/portal";

// Selected fields and original, provider-matched media from
// .legacy-reiseportal/normalized/companies.json (articles 443, 464, 470,
// 465, 480) and company-media-manifest.json. Villner Hof has no media there.
export const reiseportalPreview: Listing[] = [
  {
    id: "legacy:443", slug: "bayerischer-wald", name: "Bayerischer Wald", initials: "BW",
    tagline: "Endlose Wiesen, grüne Wälder und Natur soweit das Auge reicht.",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [
      { src: "/reiseportal/unterkuenfte/bayerischer-wald/01.jpg", alt: "Ferienanlage am Nationalpark Bayerischer Wald" },
      { src: "/reiseportal/unterkuenfte/bayerischer-wald/02.jpg", alt: "Ferienanlage im Bayerischen Wald" },
      { src: "/reiseportal/unterkuenfte/bayerischer-wald/03.jpg", alt: "Unterkunft im Bayerischen Wald" },
      { src: "/reiseportal/unterkuenfte/bayerischer-wald/04.jpg", alt: "Luchse im Nationalpark Bayerischer Wald" },
    ],
    location: { street: "Weiherweg 5 a – 11 b", postalCode: "94556", city: "Neuschönau", region: "", country: "Deutschland" },
    contact: { email: "", phone: "0171/4082656", website: "https://www.ferienanlage-am-nationalpark.de/" },
    isDemo: false, isPreview: true,
  },
  {
    id: "legacy:464", slug: "hoeflehner", name: "Höflehner", initials: "H",
    tagline: "Erleben Sie kulinarische Highlights und ein umfangreiches Angebot an Aktivitäten und Entspannungsmöglichkeiten.",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [
      { src: "/reiseportal/unterkuenfte/hoeflehner/01.jpg", alt: "Wandern beim Höflehner" },
      { src: "/reiseportal/unterkuenfte/hoeflehner/02.jpg", alt: "Familienurlaub beim Höflehner" },
      { src: "/reiseportal/unterkuenfte/hoeflehner/03.jpg", alt: "Wellness beim Höflehner" },
    ],
    location: { street: "Gumpenberg 2", postalCode: "8967", city: "Haus/Ennstal", region: "", country: "Österreich" },
    contact: { email: "", phone: "+43 3686 2548", website: "https://www.hoeflehner.com/" },
    isDemo: false, isPreview: true,
  },
  {
    id: "legacy:470", slug: "pension-sonnenhof", name: "Pension Sonnenhof", initials: "PS",
    tagline: "Der Sonnenhof am Logenplatz in Meransen. Urlaub in der Ski- & Almenregion Gitschberg Jochtal.",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [
      { src: "/reiseportal/unterkuenfte/pension-sonnenhof/01.jpg", alt: "Pension Sonnenhof in Meransen" },
      { src: "/reiseportal/unterkuenfte/pension-sonnenhof/02.jpg", alt: "Eindrücke aus der Pension Sonnenhof" },
      { src: "/reiseportal/unterkuenfte/pension-sonnenhof/03.jpg", alt: "Unterkunft in der Pension Sonnenhof" },
    ],
    location: { street: "Lindenstrasse 10", postalCode: "39037", city: "Mühlbach", region: "", country: "Italien" },
    contact: { email: "", phone: "+39 0472 520164", website: "https://www.pension-sonnenhof.info/" },
    isDemo: false, isPreview: true,
  },
  {
    id: "legacy:465", slug: "schafhuber", name: "Schafhuber", initials: "S",
    tagline: "Viele Wege führen ins Salzburgerland, dort wo der Himmel die Erde berührt …",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [
      { src: "/reiseportal/unterkuenfte/schafhuber/01.jpg", alt: "Berglandschaft beim Schafhuber" },
      { src: "/reiseportal/unterkuenfte/schafhuber/02.jpg", alt: "Eindrücke vom Schafhuber" },
      { src: "/reiseportal/unterkuenfte/schafhuber/03.jpg", alt: "Unterkunft beim Schafhuber" },
      { src: "/reiseportal/unterkuenfte/schafhuber/04.jpg", alt: "Urlaub beim Schafhuber" },
    ],
    location: { street: "Urslaustraße 4-6", postalCode: "5761", city: "Maria Alm-Hinterthal", region: "", country: "Österreich" },
    contact: { email: "", phone: "+43 6584 8147-0", website: "https://www.landhotel-schafhuber.at" },
    isDemo: false, isPreview: true,
  },
  {
    id: "legacy:480", slug: "villner-hof", name: "Villner Hof", initials: "VH",
    tagline: "Der „Villner Hof“ befindet sich inmitten von Obst- und Weingärten, in sonniger Lage.",
    description: "", directoryPackage: "basic", categoryIds: [], services: [], images: [],
    location: { street: "Villnerstraße 30", postalCode: "39044", city: "Vill bei Neumarkt", region: "", country: "Italien" },
    contact: { email: "", phone: "+39 0471 812 039", website: "" },
    isDemo: false, isPreview: true,
  },
];
