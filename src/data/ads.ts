import type { AdCreative, AdPlacement } from "@/types/portal";

const placements: AdPlacement[] = [
  "destination_top",
  "destination_sidebar_1",
  "destination_sidebar_2",
  "destination_sidebar_3",
];
export const mockAds: AdCreative[] = placements.map((placement, index) => ({
  id: `demo-ad-${index}`,
  placement,
  advertiser: [
    "Auszeit in den Bergen",
    "Sonnental Reisen",
    "Alpenzeit",
    "Berg & See",
  ][index],
  title: [
    "Ein bisschen weiter weg. Ein bisschen näher bei sich.",
    "Der nächste Lieblingsort wartet.",
    "Draußen sein. Bei sich ankommen.",
    "Zeit für eine neue Perspektive.",
  ][index],
  text: "Fiktives Werbemotiv · Keine buchbare Reise",
  image: {
    src: "/images/mountains.svg",
    alt: "Illustrierte Alpenlandschaft als Mock-Werbemotiv",
  },
  targetUrl: "/portal-vorschau#werbehinweis",
  active: true,
  startsAt: "2026-01-01",
  endsAt: "2026-12-31",
  locations: ["Bayern"],
  categoryIds: ["hotel"],
  priority: index,
  isDemo: true,
}));
