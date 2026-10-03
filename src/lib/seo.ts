import "server-only";
import type { Metadata, MetadataRoute } from "next";
import type { Listing } from "@/types/portal";
import { destinations, travelThemes, type DiscoveryEntry } from "@/data/reiseportal-discovery";
import { demoProfileId, demoPublicSlug, demoSourceSlug } from "./reiseportal-demo";
import { siteSeo, siteUrl, type SiteSeo } from "./site-seo";

export type SearchParameters = Record<string, string | string[] | undefined>;

export function plainSeoText(value: string | undefined | null) {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" };
  return (value ?? "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi, (_, entity: string) => {
      if (entity[0] !== "#") return named[entity.toLowerCase()] ?? " ";
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function seoExcerpt(value: string, limit = 170) {
  const text = plainSeoText(value);
  if (text.length <= limit) return text;
  const candidate = text.slice(0, limit - 1);
  const sentence = Math.max(candidate.lastIndexOf(". "), candidate.lastIndexOf("! "), candidate.lastIndexOf("? "));
  if (sentence > limit / 2) return candidate.slice(0, sentence + 1);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary > limit / 2 ? boundary : candidate.length).trimEnd()}…`;
}

export function pageMetadata({ title, description, path, noindex = false, image, home = false }: {
  title: string; description: string; path?: string; noindex?: boolean; image?: string; home?: boolean;
}, config: SiteSeo = siteSeo()): Metadata {
  const cleanTitle = plainSeoText(title);
  const cleanDescription = seoExcerpt(description);
  const canonical = path ? siteUrl(path, config) : undefined;
  const imageUrl = siteUrl(image?.startsWith("/") ? image : config.defaultImage, config);
  const shareTitle = home ? cleanTitle : `${cleanTitle} | ${config.siteName}`;
  return {
    title: home ? { absolute: cleanTitle } : cleanTitle,
    description: cleanDescription,
    robots: { index: config.indexable && !noindex, follow: true },
    alternates: canonical ? { canonical } : undefined,
    openGraph: { type: "website", siteName: config.siteName, locale: config.locale,
      title: shareTitle, description: cleanDescription, ...(canonical ? { url: canonical } : {}),
      ...(imageUrl ? { images: [{ url: imageUrl, alt: cleanTitle }] } : {}) },
    twitter: { card: imageUrl ? "summary_large_image" : "summary", title: shareTitle,
      description: cleanDescription, ...(imageUrl ? { images: [imageUrl] } : {}) },
  };
}

export function rootMetadata(config: SiteSeo = siteSeo()): Metadata {
  return { ...pageMetadata({ title: config.defaultTitle, description: config.defaultDescription, noindex: true }, config),
    title: { default: config.defaultTitle, template: config.titleTemplate },
    robots: { index: false, follow: false },
    ...(config.canonicalOrigin ? { metadataBase: new URL(config.canonicalOrigin) } : {}) };
}

export const hubDescriptions = {
  destinations: "Entdecken Sie Deutschland, Österreich, die Schweiz und Südtirol/Italien. Reiseziele, Regionen und reale Gastgeber im DAS Reiseportal kennenlernen.",
  themes: "Reisen nach Ihrem Motto: Natur, Wandern, Wellness, Familie und weitere Reisethemen. Entdecken Sie zwölf Mottoreisen und passend zugeordnete Anbieter.",
  directory: "Hotels, Pensionen, Ferienwohnungen und weitere Reiseanbieter entdecken. Filtern Sie nach Reiseziel und Reisethema und finden Sie Standort, Bilder und Kontakt.",
};

export function discoveryMetadata(entry: DiscoveryEntry, kind: "destination" | "theme", config: SiteSeo = siteSeo()) {
  const description = kind === "destination"
    ? `${entry.title} im DAS Reiseportal: Entdecken Sie passende Unterkünfte mit Standort, Kontakt und zugeordneten Reisethemen.`
    : `${entry.title}: ${plainSeoText(entry.intro)}`;
  return pageMetadata({ title: `${entry.title} – ${kind === "destination" ? "Reiseziele und Unterkünfte" : "Reisethema und passende Anbieter"}`,
    description, path: `/${kind === "destination" ? "reiseziele" : "mottoreisen"}/${entry.slug}`, image: entry.image ?? undefined }, config);
}

export function directoryMetadata(params: SearchParameters, config: SiteSeo = siteSeo()) {
  const filtered = Object.values(params).some(value => Array.isArray(value) ? value.some(Boolean) : Boolean(value));
  const relevant = Object.keys(params).filter(key => params[key] !== undefined && params[key] !== "");
  const single = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const destination = relevant.length === 1 && relevant[0] === "ziel" ? destinations.find(entry => entry.slug === single("ziel")) : undefined;
  const theme = relevant.length === 1 && relevant[0] === "thema" ? travelThemes.find(entry => entry.slug === single("thema")) : undefined;
  const path = destination ? `/reiseziele/${destination.slug}` : theme ? `/mottoreisen/${theme.slug}` : "/unterkuenfte-a-z";
  return pageMetadata({ title: "Unterkünfte A–Z – Gastgeber entdecken", description: hubDescriptions.directory, path, noindex: filtered }, config);
}

export function indexableProfile(listing: Pick<Listing, "id" | "slug" | "isDemo" | "isPreview">) {
  return !listing.isDemo && !listing.isPreview && listing.id !== demoProfileId &&
    ![demoPublicSlug, demoSourceSlug].includes(listing.slug);
}

export function profileDescription(listing: Listing) {
  const name = plainSeoText(listing.name);
  const location = plainSeoText(listing.location.city || listing.location.region);
  const prefix = `${name}${location ? ` in ${location}` : ""}.`;
  const detail = plainSeoText(listing.tagline) || plainSeoText(listing.description);
  return seoExcerpt(`${prefix} ${detail || "Standort und Kontaktinformationen im DAS Reiseportal."}`);
}

export function profileMetadata(listing: Listing, config: SiteSeo = siteSeo()) {
  const location = plainSeoText(listing.location.city || listing.location.region);
  return pageMetadata({ title: `${listing.name}${location ? ` in ${location}` : ""}`,
    description: profileDescription(listing), noindex: !indexableProfile(listing),
    path: indexableProfile(listing) ? `/unterkuenfte/${listing.slug}` : undefined,
    image: listing.images.find(image => image.src.startsWith("/"))?.src }, config);
}

export function sitemapEntries(profiles: Pick<Listing, "id" | "slug" | "isDemo" | "isPreview">[], config: SiteSeo = siteSeo()): MetadataRoute.Sitemap {
  if (!config.indexable) return [];
  const paths = ["/", "/reiseziele", "/mottoreisen", "/unterkuenfte-a-z", "/werbung", "/fuer-unternehmen",
    ...destinations.map(entry => `/reiseziele/${entry.slug}`), ...travelThemes.map(entry => `/mottoreisen/${entry.slug}`),
    ...profiles.filter(indexableProfile).map(profile => `/unterkuenfte/${profile.slug}`)];
  return [...new Set(paths)].flatMap(path => { const url = siteUrl(path, config); return url ? [{ url }] : []; });
}

export function robotsRules(config: SiteSeo = siteSeo()): MetadataRoute.Robots {
  // Allow noindex pages to be crawled so robots metadata can actually be read.
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/firma/", "/api/", "/auth/"] },
    ...(config.indexable ? { sitemap: siteUrl("/sitemap.xml", config) } : {}) };
}
