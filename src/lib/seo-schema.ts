import "server-only";
import type { Listing } from "@/types/portal";
import type { PublicTravelTerm } from "./reiseportal-filter-options";
import type { BreadcrumbItem } from "./breadcrumbs";
import { siteSeo, siteUrl, type SiteSeo } from "./site-seo";
import { indexableProfile, plainSeoText, profileDescription } from "./seo";

type Schema = Record<string, unknown>;
function clean(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) { const items = value.map(clean).filter(item => item !== undefined); return items.length ? items : undefined; }
  if (typeof value === "object") {
    const entries = Object.entries(value).flatMap(([key, item]) => { const result = clean(item); return result === undefined ? [] : [[key, result]]; });
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value;
}

export function jsonLdGraph(nodes: (Schema | null)[]) {
  const graph = nodes.filter(node => node !== null).map(clean);
  return graph.length ? { "@context": "https://schema.org", "@graph": graph } : null;
}

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function breadcrumbSchema(items: BreadcrumbItem[], config: SiteSeo = siteSeo()): Schema | null {
  // A valid BreadcrumbList needs absolute destinations. Wait for launch origin.
  if (!config.canonicalOrigin) return null;
  return { "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({
    "@type": "ListItem", position: index + 1, name: item.name, item: siteUrl(item.path, config),
  })) };
}

export function websiteSchema(config: SiteSeo = siteSeo()): Schema[] {
  const url = siteUrl("/", config);
  return [
    { "@type": "Organization", "@id": url ? `${url}#organization` : undefined,
      name: config.organizationName, url, logo: siteUrl("/brand/das-reiseportal-logo.png", config) },
    { "@type": "WebSite", "@id": url ? `${url}#website` : undefined, name: config.siteName,
      url, inLanguage: config.language, description: config.defaultDescription,
      publisher: url ? { "@id": `${url}#organization` } : undefined },
  ];
}

export function collectionSchema({ name, description, path, items, about }: {
  name: string; description: string; path: string; items: { name: string; path: string }[]; about?: Schema;
}, config: SiteSeo = siteSeo()): Schema {
  return { "@type": "CollectionPage", name, description: plainSeoText(description), url: siteUrl(path, config),
    inLanguage: config.language, about,
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items.map((item, index) => ({
      "@type": "ListItem", position: index + 1,
      item: { "@type": "WebPage", name: plainSeoText(item.name), url: siteUrl(item.path, config) },
    })) } };
}

function websiteUrl(value: string) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined; }
  catch { return undefined; }
}

export function profileSchema(listing: Listing, terms: PublicTravelTerm[], config: SiteSeo = siteSeo()): Schema[] {
  if (!indexableProfile(listing)) return [];
  const assigned = terms.filter(term => listing.travelTermKeys?.includes(term.term_key));
  const accommodation = assigned.filter(term => term.dimension === "accommodation");
  const type = accommodation.some(term => term.slug === "hotel") ? "Hotel"
    : accommodation.length ? "LodgingBusiness" : "Organization";
  const url = siteUrl(`/unterkuenfte/${listing.slug}`, config);
  const entityId = url ? `${url}#provider` : undefined;
  const address = {
    streetAddress: plainSeoText(listing.location.street), postalCode: plainSeoText(listing.location.postalCode),
    addressLocality: plainSeoText(listing.location.city), addressRegion: plainSeoText(listing.location.region),
    addressCountry: plainSeoText(listing.location.country),
  };
  const knowsAbout = assigned.map(term => ({ "@type": "DefinedTerm", name: term.label, termCode: term.term_key }));
  return [
    { "@type": type, "@id": entityId, name: plainSeoText(listing.name), url,
      description: profileDescription(listing), telephone: plainSeoText(listing.contact.phone),
      email: plainSeoText(listing.contact.email), sameAs: websiteUrl(listing.contact.website),
      address: Object.values(address).some(Boolean) ? { "@type": "PostalAddress", ...address } : undefined,
      image: listing.images.filter(image => image.src.startsWith("/")).map(image => siteUrl(image.src, config)),
      knowsAbout },
    { "@type": "WebPage", name: plainSeoText(listing.name), url, inLanguage: config.language,
      dateModified: listing.freshness?.content_updated_at ?? undefined,
      mainEntity: entityId ? { "@id": entityId } : { "@type": type, name: plainSeoText(listing.name) },
      about: knowsAbout, audience: assigned.filter(term => term.dimension === "audience")
        .map(term => ({ "@type": "Audience", audienceType: term.label })) },
  ];
}
