import type { Listing } from "@/types/portal";

// TEMPORARY PREVIEW DATA – REMOVE WHEN JOOMLA MIGRATION IS IMPLEMENTED.
// Selected fields from .legacy-reiseportal/normalized/companies.json (articles
// 443, 464, 470, 465, 480), in the current live Unterkünfte A–Z order.
// The four VIP="Complete" records use the existing Premium presentation;
// Villner Hof has no VIP value and stays Basic. No legacy media is included.
export const reiseportalPreview: Listing[] = [
  {
    id: "legacy:443", slug: "bayerischer-wald", name: "Bayerischer Wald", initials: "BW",
    tagline: "Endlose Wiesen, grüne Wälder und Natur soweit das Auge reicht.",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [],
    location: { street: "Weiherweg 5 a – 11 b", postalCode: "94556", city: "Neuschönau", region: "", country: "Deutschland" },
    contact: { email: "", phone: "0171/4082656", website: "https://www.ferienanlage-am-nationalpark.de/" },
    isDemo: false, isPreview: true,
  },
  {
    id: "legacy:464", slug: "höflehner", name: "Höflehner", initials: "H",
    tagline: "Erleben Sie kulinarische Highlights und ein umfangreiches Angebot an Aktivitäten und Entspannungsmöglichkeiten.",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [],
    location: { street: "Gumpenberg 2", postalCode: "8967", city: "Haus/Ennstal", region: "", country: "Österreich" },
    contact: { email: "", phone: "+43 3686 2548", website: "https://www.hoeflehner.com/" },
    isDemo: false, isPreview: true,
  },
  {
    id: "legacy:470", slug: "pension-sonnenhof", name: "Pension Sonnenhof", initials: "PS",
    tagline: "Der Sonnenhof am Logenplatz in Meransen. Urlaub in der Ski- & Almenregion Gitschberg Jochtal.",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [],
    location: { street: "Lindenstrasse 10", postalCode: "39037", city: "Mühlbach", region: "", country: "Italien" },
    contact: { email: "", phone: "+39 0472 520164", website: "https://www.pension-sonnenhof.info/" },
    isDemo: false, isPreview: true,
  },
  {
    id: "legacy:465", slug: "schafhuber", name: "Schafhuber", initials: "S",
    tagline: "Viele Wege führen ins Salzburgerland, dort wo der Himmel die Erde berührt …",
    description: "", directoryPackage: "premium", categoryIds: [], services: [], images: [],
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
  {
    id: "preview:demo-gmbh", slug: "demo-gmbh", name: "Demo GmbH", initials: "DG",
    tagline: "", description: "", directoryPackage: "basic", categoryIds: [], services: [], images: [],
    location: { street: "", postalCode: "", city: "", region: "", country: "" },
    contact: { email: "", phone: "", website: "" },
    isDemo: true, isPreview: true, demoLabel: "Demo/Testprofil",
  },
];
