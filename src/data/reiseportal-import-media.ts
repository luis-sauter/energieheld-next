import type { PortalImage } from "@/types/portal";

type LegacyMedia = { logo?: PortalImage; images: PortalImage[] };

// Presentation fallbacks for the five selected Joomla records. Genuine media
// uploaded later through the existing editor always takes precedence.
function gallery(slug: string, name: string, count: number, extension = "jpg"): PortalImage[] {
  return Array.from({ length: count }, (_, index) => ({
    src: `/reiseportal/unterkuenfte/${slug}/${String(index + 1).padStart(2, "0")}.${extension}`,
    alt: `${name} – Galeriebild ${index + 1}`,
  }));
}

export const importedJoomlaMedia: Readonly<Record<string, LegacyMedia>> = {
  "wirodive-tauchreisen": {
    logo: { src: "/reiseportal/unterkuenfte/wirodive-tauchreisen/logo.png", alt: "Logo von WIRODIVE" },
    images: [],
  },
  wirthshof: {
    logo: { src: "/reiseportal/unterkuenfte/wirthshof/logo.jpg", alt: "Logo des Wirthshofs" },
    images: gallery("wirthshof", "Wirthshof", 5),
  },
  "anni-romantikhaeuschen": {
    logo: { src: "/reiseportal/unterkuenfte/anni-romantikhaeuschen/logo.jpg", alt: "Logo von Anni´s Romantikhäuschen" },
    images: gallery("anni-romantikhaeuschen", "Anni´s Romantikhäuschen", 9),
  },
  "hotel-zur-post": {
    logo: { src: "/reiseportal/unterkuenfte/hotel-zur-post/logo.png", alt: "Logo des Hotels zur Post" },
    images: gallery("hotel-zur-post", "Hotel zur Post", 1, "png"),
  },
  "golfhotel-andreus": {
    logo: { src: "/reiseportal/unterkuenfte/golfhotel-andreus/logo.jpg", alt: "Logo des Golfhotels Andreus" },
    images: gallery("golfhotel-andreus", "Golfhotel Andreus", 8),
  },
};
