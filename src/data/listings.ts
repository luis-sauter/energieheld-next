import type { Listing, QualityBadge } from "@/types/portal";

const photos = {
  house: { src: "/images/house.jpg", alt: "Modernes Wohnhaus – Symbolbild" },
  solar: {
    src: "/images/solar.jpg",
    alt: "Photovoltaik auf einem Hausdach – Symbolbild",
  },
  home: {
    src: "/images/home.jpg",
    alt: "Wohngebäude mit großzügigen Fensterflächen – Symbolbild",
  },
};

type Seed = [
  string,
  string,
  string,
  string,
  string[],
  string,
  string,
  string[],
];
const seeds: Seed[] = [
  [
    "mueller-haustechnik",
    "Müller Haustechnik",
    "MH",
    "Wärme, die zu Ihrem Zuhause passt.",
    ["heizung", "solar"],
    "München",
    "80331",
    ["Wärmepumpen", "Heizungsmodernisierung", "Solarthermie"],
  ],
  [
    "sonnenwerk-oberland",
    "Sonnenwerk Oberland",
    "SO",
    "Ihr Dach kann mehr. Nutzen Sie die Sonne.",
    ["solar", "elektro"],
    "Starnberg",
    "82319",
    ["Photovoltaik", "Batteriespeicher", "Wallboxen"],
  ],
  [
    "klarblick-energieberatung",
    "Klarblick Energieberatung",
    "KE",
    "Ein guter Plan für die Zukunft Ihres Hauses.",
    ["energieberatung"],
    "München",
    "81241",
    ["Sanierungsfahrplan", "Energiebedarf", "Modernisierungsplanung"],
  ],
  [
    "holz-dach-berger",
    "Holz & Dach Berger",
    "HB",
    "Handwerk mit Weitblick. Vom Dach bis ins Detail.",
    ["dach"],
    "Rosenheim",
    "83022",
    ["Dachsanierung", "Dämmung", "Holzbau"],
  ],
  [
    "elektro-lichtpunkt",
    "Elektro Lichtpunkt",
    "EL",
    "Intelligente Technik. Einfach gut vernetzt.",
    ["elektro"],
    "Augsburg",
    "86150",
    ["Elektroinstallation", "Smart Home", "Ladeinfrastruktur"],
  ],
  [
    "fensterwerk-isartal",
    "Fensterwerk Isartal",
    "FI",
    "Mehr Licht. Mehr Komfort. Weniger Wärmeverlust.",
    ["fenster"],
    "Freising",
    "85354",
    ["Fenstertausch", "Haustüren", "Sonnenschutz"],
  ],
  [
    "waermezeit-bayern",
    "Wärmezeit Bayern",
    "WB",
    "Durchdachte Heiztechnik für morgen.",
    ["heizung", "energieberatung"],
    "Augsburg",
    "86152",
    ["Wärmepumpen", "Heizungsplanung", "Hydraulischer Abgleich"],
  ],
  [
    "dachraum-muenchen",
    "Dachraum München",
    "DM",
    "Gut geschützt. Nachhaltig modernisiert.",
    ["dach", "fenster"],
    "München",
    "80999",
    ["Dachdämmung", "Dachfenster", "Dachausbau"],
  ],
];

export const listings: Listing[] = seeds.map(
  (
    [slug, name, initials, tagline, categoryIds, city, postalCode, services],
    index,
  ) => ({
    id: slug,
    slug,
    name,
    initials,
    tagline,
    categoryIds,
    description: `${name} ist ein fiktiver Fachbetrieb aus ${city}. Dieses Beispielprofil zeigt, wie sich Unternehmen künftig mit ihren Leistungen vorstellen können. Im Mittelpunkt stehen eine persönliche Beratung, nachvollziehbare Planung und die passende Umsetzung für das jeweilige Gebäude. Sämtliche Angaben dienen ausschließlich der Gestaltungsvorschau.`,
    location: { city, postalCode, region: "Bayern", country: "Deutschland" },
    services,
    images:
      index % 3 === 1
        ? [photos.solar, photos.house, photos.home]
        : index % 3 === 2
          ? [photos.home, photos.solar, photos.house]
          : [photos.house, photos.home, photos.solar],
    contact: {
      email: `kontakt@${slug}.example`,
      phone: "+49 (0) 00 / 000 00 00",
      website: `https://${slug}.example`,
    },
    isDemo: true,
  }),
);

export const qualityBadges: QualityBadge[] = [
  {
    listingId: "mueller-haustechnik",
    label: "Qualitätsstempel · Vorschau",
    isDemo: true,
  },
];

export const travelListing: Listing = {
  id: "alpenhotel-sonnental",
  slug: "alpenhotel-sonnental",
  name: "Alpenhotel Sonnental",
  initials: "AS",
  tagline: "Ankommen. Durchatmen. Die Berge genießen.",
  description:
    "Fiktives Hotelprofil zum Prüfen der gemeinsamen Portal-Komponenten.",
  categoryIds: ["hotel"],
  location: {
    city: "Garmisch-Partenkirchen",
    postalCode: "82467",
    region: "Bayern",
    country: "Deutschland",
  },
  services: ["Frühstück", "Bergblick", "Wanderwege"],
  images: [
    {
      src: "/images/mountains.svg",
      alt: "Illustrative Berglandschaft für ein fiktives Hotel",
    },
  ],
  contact: {
    email: "hallo@sonnental.example",
    phone: "+49 (0) 00 / 000 00 00",
    website: "https://sonnental.example",
  },
  isDemo: true,
};
