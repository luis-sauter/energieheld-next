import type { AdCreative } from "@/types/portal";

const creatives: Pick<
  AdCreative,
  "id" | "placement" | "advertiser" | "title" | "text" | "image" | "tone"
>[] = [
  {
    id: "energy-top",
    placement: "trade_top",
    advertiser: "Sonnenwerk · Beispielanzeige",
    title: "Ihr Dach. Ihre Energie. Ihre Zukunft.",
    text: "Photovoltaik und Speicher – ein fiktives Werbeangebot.",
    image: {
      src: "/images/trades/photovoltaik.jpg",
      alt: "Solarmodule als Symbolbild der Beispielanzeige",
    },
    tone: "blue",
  },
  {
    id: "energy-side-1",
    placement: "trade_sidebar_1",
    advertiser: "Wärmezeit · Beispielanzeige",
    title: "Zeit für eine neue Wärme.",
    text: "Heiztechnik für Ihr Zuhause.",
    image: {
      src: "/images/trades/heizung.jpg",
      alt: "Heizungsrohre als Symbolbild",
    },
    tone: "orange",
  },
  {
    id: "energy-side-2",
    placement: "trade_sidebar_2",
    advertiser: "Fensterwerk · Beispielanzeige",
    title: "Ein neuer Blick nach draußen.",
    text: "Fenster und Türen neu denken.",
    image: {
      src: "/images/trades/fenster-tuer.jpg",
      alt: "Fenster als Symbolbild",
    },
    tone: "blue",
  },
  {
    id: "energy-side-3",
    placement: "trade_sidebar_3",
    advertiser: "Dachraum · Beispielanzeige",
    title: "Gut gedämmt. Gut zu Hause.",
    text: "Ideen für Ihre Modernisierung.",
    image: {
      src: "/images/trades/daemmung.jpg",
      alt: "Dämmmaterial als Symbolbild",
    },
    tone: "green",
  },
];

export const energyAds: AdCreative[] = creatives.map((ad) => ({
  ...ad,
  targetUrl: "/werbung",
  active: true,
  locations: ["Bayern"],
  categoryIds: [],
  priority: 0,
  isDemo: true,
}));
