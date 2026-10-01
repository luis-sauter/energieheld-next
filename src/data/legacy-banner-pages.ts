// Public presentation data: live Joomla banner IDs and exported click URLs, reconciled 2026-10-01.
// Internal research remains outside this repository. Admin presentation overrides remain authoritative.
import type { AdPlacementId } from "../lib/ad-values";
import type { BannerSize } from "../lib/banner-presentation";
export type LegacyPageBanner = { id: string; placement: AdPlacementId; imageUrl: string; targetUrl: string; alt: string; width: number; height: number; size: BannerSize; mobile?: { imageUrl: string; width: number; height: number } };
export const legacyBannerPages: Readonly<Record<string, readonly LegacyPageBanner[]>> = {
  "/": [
    {
      "id": "legacy-56",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/367.jpg",
      "targetUrl": "https://www.neue-schaenke.de/",
      "alt": "Neue Schaenke",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/70.jpg",
        "width": 350,
        "height": 120
      }
    },
    {
      "id": "city-apart-square",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/city-apart-square.jpg",
      "targetUrl": "https://city-apart-dresden.de/",
      "alt": "City Apart Dresden",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "haus-salzburg",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/haus-salzburg.jpg",
      "targetUrl": "https://haus-salzburg.de/",
      "alt": "Haus Salzburg Bad Füssing",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "ferienanlage-nationalpark",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/ferienanlage-nationalpark.jpg",
      "targetUrl": "https://www.ferienanlage-am-nationalpark.de/",
      "alt": "Ferienanlage am Nationalpark",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "annis-romantikhaeuschen",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/annis-romantikhaeuschen.jpg",
      "targetUrl": "https://www.annis-romantikhaeuschen.de/",
      "alt": "Annis Romantikhaeuschen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "fewo-sieber",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/fewo-sieber.jpg",
      "targetUrl": "https://fewo-sieber.de/index.html",
      "alt": "Ferienwohnung Sieber",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "city-apart-wide",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/city-apart-wide.jpg",
      "targetUrl": "https://city-apart-dresden.de/index.php",
      "alt": "City Apart Dresden",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "rodelpark-oderwitz",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/rodelpark-oderwitz.jpg",
      "targetUrl": "https://rodelbahn-oderwitz.de/",
      "alt": "Rodelbahn Oderwitz",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "ferienbauernhof-buechele",
      "placement": "sidebar_08",
      "imageUrl": "/images/legacy-ads/ferienbauernhof-buechele.jpg",
      "targetUrl": "https://www.ferienbauernhof-buechele.de/",
      "alt": "Ferienbauernhof Büchele",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "barfusspark",
      "placement": "sidebar_09",
      "imageUrl": "/images/legacy-ads/barfusspark.jpg",
      "targetUrl": "https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/",
      "alt": "Barfusspark",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "neue-schaenke",
      "placement": "sidebar_10",
      "imageUrl": "/images/legacy-ads/neue-schaenke.jpg",
      "targetUrl": "https://www.neue-schaenke.de/",
      "alt": "Neue Schaenke",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen": [],
  "/reiseziele": [],
  // Restore the proven pre-reconciliation A–Z rail (commit 5603997), scoped to this page.
  // No historical Premium creative was rendered by that directory.
  "/unterkuenfte-a-z": [
    { id: "city-apart-square", placement: "sidebar_top", imageUrl: "/images/legacy-ads/city-apart-square.jpg", targetUrl: "https://city-apart-dresden.de/", alt: "City Apart Dresden", width: 350, height: 350, size: "large" },
    { id: "haus-salzburg", placement: "sidebar_middle", imageUrl: "/images/legacy-ads/haus-salzburg.jpg", targetUrl: "https://haus-salzburg.de/", alt: "Haus Salzburg Bad Füssing", width: 350, height: 120, size: "small" },
    { id: "ferienanlage-nationalpark", placement: "sidebar_bottom", imageUrl: "/images/legacy-ads/ferienanlage-nationalpark.jpg", targetUrl: "https://www.ferienanlage-am-nationalpark.de/", alt: "Ferienanlage am Nationalpark", width: 350, height: 120, size: "small" },
    { id: "annis-romantikhaeuschen", placement: "sidebar_04", imageUrl: "/images/legacy-ads/annis-romantikhaeuschen.jpg", targetUrl: "https://www.annis-romantikhaeuschen.de/", alt: "Annis Romantikhäuschen", width: 350, height: 120, size: "small" },
    { id: "fewo-sieber", placement: "sidebar_05", imageUrl: "/images/legacy-ads/fewo-sieber.jpg", targetUrl: "https://fewo-sieber.de/index.html", alt: "Ferienwohnung Sieber", width: 350, height: 120, size: "small" },
    { id: "city-apart-wide", placement: "sidebar_06", imageUrl: "/images/legacy-ads/city-apart-wide.jpg", targetUrl: "https://city-apart-dresden.de/index.php", alt: "City Apart Dresden", width: 350, height: 120, size: "small" },
    { id: "rodelpark-oderwitz", placement: "sidebar_07", imageUrl: "/images/legacy-ads/rodelpark-oderwitz.jpg", targetUrl: "https://rodelbahn-oderwitz.de/", alt: "Rodelbahn Oderwitz", width: 350, height: 120, size: "small" },
    { id: "ferienbauernhof-buechele", placement: "sidebar_08", imageUrl: "/images/legacy-ads/ferienbauernhof-buechele.jpg", targetUrl: "https://www.ferienbauernhof-buechele.de/", alt: "Ferienbauernhof Büchele", width: 350, height: 120, size: "small" },
    { id: "barfusspark", placement: "sidebar_09", imageUrl: "/images/legacy-ads/barfusspark.jpg", targetUrl: "https://www.barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/", alt: "Barfußpark Schwackendorf", width: 350, height: 120, size: "small" },
    { id: "neue-schaenke", placement: "sidebar_10", imageUrl: "/images/legacy-ads/neue-schaenke.jpg", targetUrl: "https://www.neue-schaenke.de/", alt: "Neue Schänke", width: 350, height: 120, size: "small" }
  ],
  "/mottoreisen/natur-pur": [
    {
      "id": "legacy-367",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/367.jpg",
      "targetUrl": "https://www.neue-schaenke.de/",
      "alt": "Neue Schaenke",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/368.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-539",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/539.jpg",
      "targetUrl": "https://www.annis-romantikhaeuschen.de/",
      "alt": "Annis Romantikhaeuschen",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "legacy-360",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/358.jpg",
      "targetUrl": "https://www.annis-romantikhaeuschen.de/",
      "alt": "Annis Romantikhaeuschen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-377",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/375.jpg",
      "targetUrl": "https://www.hotel-kronplatz.com/de/",
      "alt": "Hotel Kronplatz",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-379",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/389.jpg",
      "targetUrl": "https://www.kesselgrub.at/de",
      "alt": "Kesselgrub",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-381",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/383.jpg",
      "targetUrl": "https://www.ostseehotel-dierhagen.de/de/home",
      "alt": "Ostseehotel Dierhagen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-385",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/387.jpg",
      "targetUrl": "https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/",
      "alt": "Barfusspark",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-391",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/391.jpg",
      "targetUrl": "https://www.aparthotel-oberhof.de/",
      "alt": "Aparthotel Oberhof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-412",
      "placement": "sidebar_08",
      "imageUrl": "/images/legacy-ads/reconciled/414.jpg",
      "targetUrl": "https://www.ostseehotel-dierhagen.de/de/home",
      "alt": "Westerwald",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-637",
      "placement": "sidebar_09",
      "imageUrl": "/images/legacy-ads/reconciled/639.jpg",
      "targetUrl": "https://www.neue-schaenke.de/",
      "alt": "Neue Schaenke",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/nordic-walking": [
    {
      "id": "legacy-486",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/490.jpg",
      "targetUrl": "https://www.landhotel-schafhuber.at/wandern/",
      "alt": "Schafhuber",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/489.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-410",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/383.jpg",
      "targetUrl": "https://www.ostseehotel-dierhagen.de/de/home",
      "alt": "Ostseehotel Dierhagen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-416",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/414.jpg",
      "targetUrl": "https://www.westerwald.info/",
      "alt": "Westerwald",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-421",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/418.jpg",
      "targetUrl": "https://www.feldhof.com/",
      "alt": "Feldhof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-440",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/440.jpg",
      "targetUrl": "https://www.muehlvitalresort.de/",
      "alt": "Mühl Vital Resort",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-448",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/452.jpg",
      "targetUrl": "https://www.landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking",
      "alt": "Landhotel Talblick",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-454",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/454.jpg",
      "targetUrl": "https://www.aktivitalhotel.de/region/aktivurlaub/nordic-walking",
      "alt": "Aktivital Hotel",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-482",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/480.jpg",
      "targetUrl": "https://www.hoeflehner.com/Aktiv/Wandern",
      "alt": "Höflehner",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/radwandern": [
    {
      "id": "legacy-614",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/614.jpg",
      "targetUrl": "https://www.neckartalradweg-bw.de/",
      "alt": "Neckartal",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/615.jpg",
        "width": 350,
        "height": 120
      }
    },
    {
      "id": "legacy-468",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/471.jpg",
      "targetUrl": "https://www.visitmosel.de/familienurlaub/radfahren",
      "alt": "Mosellandtouristik GmbH",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "legacy-456",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/456.jpg",
      "targetUrl": "https://zumgoldenenochsen.de/kultur-freizeit-and-erholung/",
      "alt": "Hotel zum goldenen Ochsen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-458",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/458.jpg",
      "targetUrl": "https://fischer-hopfensee.de/erleben/",
      "alt": "Hotel Fischer am See",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-460",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/460.jpg",
      "targetUrl": "https://www.hotel-ruchti.de/urlaub-in-fuessen/fuessen",
      "alt": "Hotel Ruchti",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-462",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/462.jpg",
      "targetUrl": "https://www.chiemsee-alpenland.de/",
      "alt": "Chiemsee Alpenland",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-464",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/464.jpg",
      "targetUrl": "https://www.hotel-helmer.de/",
      "alt": "Hotel Helmer",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-466",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/466.jpg",
      "targetUrl": "https://www.vulkanradweg.de/die-gastgeber/radtouren-fuer-sie-organisiert.html",
      "alt": "Vulkan Radweg",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-640",
      "placement": "sidebar_08",
      "imageUrl": "/images/legacy-ads/reconciled/639.jpg",
      "targetUrl": "https://www.neue-schaenke.de/",
      "alt": "Neue Schaenke",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/wanderurlaub": [
    {
      "id": "legacy-487",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/490.jpg",
      "targetUrl": "https://www.landhotel-schafhuber.at/wandern/",
      "alt": "Schafhuber",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/488.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-359",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/358.jpg",
      "targetUrl": "https://www.annis-romantikhaeuschen.de/",
      "alt": "Annis Romantikhaeuschen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-414",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/414.jpg",
      "targetUrl": "https://www.westerwald.info/",
      "alt": "Westerwald",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-418",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/418.jpg",
      "targetUrl": "https://www.feldhof.com/aktivurlaub/wandern/",
      "alt": "Feldhof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-451",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/452.jpg",
      "targetUrl": "https://www.landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking",
      "alt": "Landhotel Talblick",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-472",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/475.jpg",
      "targetUrl": "https://www.jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode",
      "alt": "Jägeralpe",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-484",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/480.jpg",
      "targetUrl": "https://www.hoeflehner.com/Aktiv/Wandern",
      "alt": "Höflehner",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/familienurlaub": [
    {
      "id": "legacy-577",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/578.jpg",
      "targetUrl": "https://www.sonnwies.com/familienhotel-suedtirol",
      "alt": "Sonnwies",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/576.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-471",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/471.jpg",
      "targetUrl": "https://www.visitmosel.de/familienurlaub/radfahren",
      "alt": "Mosellandtouristik GmbH",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "legacy-393",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/389.jpg",
      "targetUrl": "https://www.kesselgrub.at/de",
      "alt": "Kesselgrub",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-395",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/387.jpg",
      "targetUrl": "https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/",
      "alt": "Barfusspark",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-442",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/444.jpg",
      "targetUrl": "https://www.rhoen-park-hotel.de/familienhotel/",
      "alt": "Röhn Park Hotel",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-397",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/397.jpg",
      "targetUrl": "https://www.ferienbauernhof-buechele.de/",
      "alt": "Ferienbauernhof Büchele",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-476",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/480.jpg",
      "targetUrl": "https://www.hoeflehner.com/Preise-Angebote/Familienurlaub-in-Oesterreich",
      "alt": "Höflehner",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-519",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/520.jpg",
      "targetUrl": "https://godewind-thiessow.de/",
      "alt": "Godewind",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-569",
      "placement": "sidebar_08",
      "imageUrl": "/images/legacy-ads/reconciled/568.jpg",
      "targetUrl": "https://www.luxoase.de/",
      "alt": "Luxoase",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-573",
      "placement": "sidebar_09",
      "imageUrl": "/images/legacy-ads/reconciled/572.jpg",
      "targetUrl": "https://www.camping-teichmann.de/",
      "alt": "Camping Teichmann",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-642",
      "placement": "sidebar_10",
      "imageUrl": "/images/legacy-ads/reconciled/375.jpg",
      "targetUrl": "https://www.hotel-kronplatz.com/de/",
      "alt": "Hotel Kronplatz",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/golfurlaub": [
    {
      "id": "legacy-235",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/235.jpg",
      "targetUrl": "https://www.hommage-hotels.com/grand-tirolia-kitzbuehel/golf-eichenheim",
      "alt": "Grand Tirolia",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/371.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-374",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/374.jpg",
      "targetUrl": "https://www.johanneshof.com/de/",
      "alt": "Johanneshof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-493",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/495.jpg",
      "targetUrl": "https://www.thechediandermatt.com/de/explore/golfhotel-schweiz",
      "alt": "The Chedi",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-497",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/498.jpg",
      "targetUrl": "https://www.golfpanorama.ch/",
      "alt": "Gold Panorama",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-501",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/502.jpg",
      "targetUrl": "https://hofmaran.ch/",
      "alt": "Hof Maran",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-505",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/508.jpg",
      "targetUrl": "https://www.gnaid.it/",
      "alt": "Gnaid",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-510",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/509.jpg",
      "targetUrl": "https://www.stroblhof.com/",
      "alt": "Stroblhof",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/tauchurlaub": [
    {
      "id": "legacy-428",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/428.jpg",
      "targetUrl": "https://rcf-tauchreisen.de/",
      "alt": "Reisecenter Federsee",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/429.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-422",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/422.jpg",
      "targetUrl": "https://www.sub-aqua.de/",
      "alt": "SUB Aqua",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-424",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/424.jpg",
      "targetUrl": "https://www.schoener-tauchen.de/",
      "alt": "Schoener Tauchen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-426",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/426.jpg",
      "targetUrl": "https://www.wernerlau.com/tauchen-malediven/",
      "alt": "Werner Lau",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-430",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/430.jpg",
      "targetUrl": "https://www.tauchsport-egginger.de/index.php",
      "alt": "Tauchschule Egginger",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-432",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/432.jpg",
      "targetUrl": "https://beyond-diving.de/",
      "alt": "Beyond Diving",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-434",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/434.jpg",
      "targetUrl": "https://www.sunandfun.com/tauchen/Tauchsafaris/",
      "alt": "Sun Fun",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-436",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/436.jpg",
      "targetUrl": "https://www.belugareisen.de/",
      "alt": "Beluga Reisen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-438",
      "placement": "sidebar_08",
      "imageUrl": "/images/legacy-ads/reconciled/438.jpg",
      "targetUrl": "https://wirodive.de/",
      "alt": "Wiro Dive",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/urlaub-am-wasser": [
    {
      "id": "legacy-531",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/533.jpg",
      "targetUrl": "https://www.hotelhirschen-bodensee.de/Hotel",
      "alt": "Hotel Hirschen Horn",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/535.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-537",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/538.jpg",
      "targetUrl": "https://www.alfsee.de/",
      "alt": "Alfsee",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "legacy-383",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/383.jpg",
      "targetUrl": "https://www.ostseehotel-dierhagen.de/de/home",
      "alt": "Ostseehotel Dierhagen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-387",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/387.jpg",
      "targetUrl": "https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/",
      "alt": "Barfusspark",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-513",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/515.jpg",
      "targetUrl": "https://roewers.de/",
      "alt": "Röwers",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-521",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/520.jpg",
      "targetUrl": "https://godewind-thiessow.de/",
      "alt": "Godewind",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-526",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/525.jpg",
      "targetUrl": "https://www.schlosshotel-ralswiek.de/",
      "alt": "Schlosshotel Ralswiek",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/campingurlaub": [
    {
      "id": "legacy-545",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/545.jpg",
      "targetUrl": "https://www.camping-amrum.de/",
      "alt": "Dünencamping Amrum",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/546.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-538",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/538.jpg",
      "targetUrl": "https://www.alfsee.de/",
      "alt": "Alfsee",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "legacy-543",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/543.jpg",
      "targetUrl": "https://www.bayregio.de/gastgeber/Campingplatz-Halbinsel-Burg",
      "alt": "Halbinsel Burg",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-556",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/556.jpg",
      "targetUrl": "https://www.allweglehen.de/de/",
      "alt": "Allweglehen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-568",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/568.jpg",
      "targetUrl": "https://www.luxoase.de/",
      "alt": "Luxoase",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-572",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/572.jpg",
      "targetUrl": "https://www.camping-teichmann.de/",
      "alt": "Camping Teichmann",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/romantik-zu-zweit": [
    {
      "id": "legacy-357",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/358.jpg",
      "targetUrl": "https://www.annis-romantikhaeuschen.de/",
      "alt": "Annis Romantikhaeuschen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-562",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/562.jpg",
      "targetUrl": "https://spacamping.de/de/angebote/angebote/angebot-zweisamkeit.php",
      "alt": "Schwarzwälderhof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-587",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/587.jpg",
      "targetUrl": "https://www.alpenhotel-montafon.net/veranstaltungen-vorarlberg/hochzeitslocation/",
      "alt": "Alpenhotel Hochzeit",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-588",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/589.jpg",
      "targetUrl": "https://www.nature-resort.at/willkommen.html",
      "alt": "Nature Resort",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-593",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/592.jpg",
      "targetUrl": "https://www.mondschein.com/",
      "alt": "Mondschein",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/wellnessangebote": [
    {
      "id": "legacy-532",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/533.jpg",
      "targetUrl": "https://www.hotelhirschen-bodensee.de/Hotel",
      "alt": "Hotel Hirschen Horn",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/536.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-446",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/444.jpg",
      "targetUrl": "https://www.rhoen-park-hotel.de/schwimmbad-sauna-fitness-wellness/",
      "alt": "Röhn Park Hotel",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-479",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/480.jpg",
      "targetUrl": "https://www.hoeflehner.com/Wellness/Naturelle-Behandlungen2",
      "alt": "Höflehner",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-514",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/515.jpg",
      "targetUrl": "https://roewers.de/",
      "alt": "Röwers",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-598",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/584.jpg",
      "targetUrl": "https://www.alpenhotel-montafon.net/",
      "alt": "Alpenhotel",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-600",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/502.jpg",
      "targetUrl": "https://hofmaran.ch/",
      "alt": "Hof Maran",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-602",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/603.jpg",
      "targetUrl": "https://www.josef.bz/de/hotel-hafling/1-0.html",
      "alt": "Hof Maran",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/mottoreisen/geschaeftsreisen": [
    {
      "id": "legacy-406",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/406.jpg",
      "targetUrl": "https://www.hyatt.com/en-US/hotel/germany/lindner-hotel-cologne-city-plaza/cgnjd/special-events",
      "alt": "Lindner Hotels",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/407.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-408",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/408.jpg",
      "targetUrl": "https://www.dasbayrischzell.de/de/seminare/move-work",
      "alt": "Das Bayrischzell",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "legacy-400",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/400.jpg",
      "targetUrl": "https://www.hotel-clemens-august.de/tagungshotel-im-muensterland",
      "alt": "Clemens August",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-402",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/402.jpg",
      "targetUrl": "https://landgut-ramshof.de/tagungen/",
      "alt": "Landgut Ramshof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-404",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/404.jpg",
      "targetUrl": "https://www.mintrops-landhotel.de/",
      "alt": "Mintrops Lanhotel",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-444",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/444.jpg",
      "targetUrl": "https://www.rhoen-park-hotel.de/tagungshotel/",
      "alt": "Röhn Park Hotel",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-527",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/525.jpg",
      "targetUrl": "https://www.schlosshotel-ralswiek.de/",
      "alt": "Schlosshotel Ralswiek",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/reiseziele/deutschland": [
    {
      "id": "legacy-533",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/533.jpg",
      "targetUrl": "https://www.hotelhirschen-bodensee.de/Hotel",
      "alt": "Hotel Hirschen Horn",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/534.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-369",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/369.jpg",
      "targetUrl": "https://city-apart-dresden.de/",
      "alt": "City Apart Dresden Empfehlung",
      "width": 350,
      "height": 350,
      "size": "large"
    },
    {
      "id": "legacy-358",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/358.jpg",
      "targetUrl": "https://www.annis-romantikhaeuschen.de/",
      "alt": "Annis Romantikhaeuschen",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-452",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/452.jpg",
      "targetUrl": "https://www.landhotel-talblick.de/",
      "alt": "Landhotel Talblick",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-515",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/515.jpg",
      "targetUrl": "https://roewers.de/",
      "alt": "Röwers",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-520",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/520.jpg",
      "targetUrl": "https://godewind-thiessow.de/",
      "alt": "Godewind",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-525",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/525.jpg",
      "targetUrl": "https://www.schlosshotel-ralswiek.de/",
      "alt": "Schlosshotel Ralswiek",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-639",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/639.jpg",
      "targetUrl": "https://www.neue-schaenke.de/",
      "alt": "Neue Schaenke",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/reiseziele/oesterreich": [
    {
      "id": "legacy-490",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/490.jpg",
      "targetUrl": "https://www.landhotel-schafhuber.at/wandern/",
      "alt": "Schafhuber",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/491.jpg",
        "width": 696,
        "height": 696
      }
    },
    {
      "id": "legacy-389",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/389.jpg",
      "targetUrl": "https://www.kesselgrub.at/de",
      "alt": "Kesselgrub",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-475",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/475.jpg",
      "targetUrl": "https://www.jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode",
      "alt": "Jägeralpe",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-480",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/480.jpg",
      "targetUrl": "https://www.hoeflehner.com",
      "alt": "Höflehner",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-584",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/584.jpg",
      "targetUrl": "https://www.alpenhotel-montafon.net/",
      "alt": "Alpenhotel",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-589",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/589.jpg",
      "targetUrl": "https://www.nature-resort.at/willkommen.html",
      "alt": "Nature Resort",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-592",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/592.jpg",
      "targetUrl": "https://www.mondschein.com/",
      "alt": "Mondschein",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-596",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/596.jpg",
      "targetUrl": "https://www.haus-terra.at/",
      "alt": "Haus Terra",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-608",
      "placement": "sidebar_08",
      "imageUrl": "/images/legacy-ads/reconciled/608.jpg",
      "targetUrl": "https://www.laerchenhof.com/",
      "alt": "Lärchenhof",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/reiseziele/schweiz": [
    {
      "id": "legacy-495",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/495.jpg",
      "targetUrl": "https://www.thechediandermatt.com/de/explore/golfhotel-schweiz",
      "alt": "The Chedi",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-498",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/498.jpg",
      "targetUrl": "https://www.golfpanorama.ch/",
      "alt": "Gold Panorama",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-502",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/502.jpg",
      "targetUrl": "https://hofmaran.ch/",
      "alt": "Hof Maran",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ],
  "/reiseziele/suedtirol-italien": [
    {
      "id": "legacy-578",
      "placement": "top_banner",
      "imageUrl": "/images/legacy-ads/reconciled/578.jpg",
      "targetUrl": "https://www.sonnwies.com/familienhotel-suedtirol",
      "alt": "Sonnwies",
      "width": 1500,
      "height": 120,
      "size": "small",
      "mobile": {
        "imageUrl": "/images/legacy-ads/reconciled/579.jpg",
        "width": 1500,
        "height": 120
      }
    },
    {
      "id": "legacy-375",
      "placement": "sidebar_top",
      "imageUrl": "/images/legacy-ads/reconciled/375.jpg",
      "targetUrl": "https://www.hotel-kronplatz.com/de/",
      "alt": "Hotel Kronplatz",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-508",
      "placement": "sidebar_middle",
      "imageUrl": "/images/legacy-ads/reconciled/508.jpg",
      "targetUrl": "https://www.gnaid.it/",
      "alt": "Gnaid",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-509",
      "placement": "sidebar_bottom",
      "imageUrl": "/images/legacy-ads/reconciled/509.jpg",
      "targetUrl": "https://www.stroblhof.com/",
      "alt": "Stroblhof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-603",
      "placement": "sidebar_04",
      "imageUrl": "/images/legacy-ads/reconciled/603.jpg",
      "targetUrl": "https://www.josef.bz/de/hotel-hafling/1-0.html",
      "alt": "Hof Maran",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-606",
      "placement": "sidebar_05",
      "imageUrl": "/images/legacy-ads/reconciled/606.jpg",
      "targetUrl": "https://www.villnerhof.com/",
      "alt": "Villner Hof",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-610",
      "placement": "sidebar_06",
      "imageUrl": "/images/legacy-ads/reconciled/610.jpg",
      "targetUrl": "https://www.steingarten.it/",
      "alt": "Pension Steingarten",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-612",
      "placement": "sidebar_07",
      "imageUrl": "/images/legacy-ads/reconciled/612.jpg",
      "targetUrl": "https://www.kaiser-hans.com/",
      "alt": "Kaiser Hans",
      "width": 350,
      "height": 120,
      "size": "small"
    },
    {
      "id": "legacy-647",
      "placement": "sidebar_08",
      "imageUrl": "/images/legacy-ads/reconciled/647.jpg",
      "targetUrl": "https://www.almhof-call.com/",
      "alt": "Almhof Call",
      "width": 350,
      "height": 120,
      "size": "small"
    }
  ]
};
