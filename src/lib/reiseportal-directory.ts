import "server-only";
import { reiseportalPreview } from "@/data/reiseportal-preview";
import { importedJoomlaMedia } from "@/data/reiseportal-import-media";
import type { Listing } from "@/types/portal";
import { directoryItemKey } from "./company-directory-order";
import { loadPublicCompanyBySlug, loadPublicCompanyDirectory } from "./public-companies";
import { demoProfileId, demoPublicSlug, demoSourceSlug } from "./reiseportal-demo";
import { loadPublicTravelAssignments } from "./public-travel-taxonomy";
import { filterTravelDiscovery } from "./reiseportal-search";

const oldEnergyContent = /energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung/i;

// Keep energy-category profiles and energy copy out of the public travel directory.
function travelVisible(listing: Listing) {
  return listing.slug !== demoSourceSlug && listing.categoryIds.length === 0 &&
    !oldEnergyContent.test([listing.name, listing.tagline, listing.description, listing.businessAreas].join(" "));
}

// This is the approved, existing test profile, presented under a travel-safe
// public alias. Suppress its energy-sector copy, including media alt text.
function publicDemo(listing: Listing): Listing | null {
  if (listing.id !== demoProfileId || listing.slug !== demoSourceSlug) return null;
  return {
    ...listing,
    slug: demoPublicSlug, name: "Demo GmbH", initials: "DG",
    tagline: "", description: "", businessAreas: "", categoryIds: [], services: [],
    logo: listing.logo ? { ...listing.logo, alt: "Logo von Demo GmbH" } : undefined,
    images: listing.images.map((image, index) => ({ ...image, alt: `Bild ${index + 1} von Demo GmbH` })),
    contact: {
      ...listing.contact,
      email: oldEnergyContent.test(listing.contact.email) ? "" : listing.contact.email,
      website: oldEnergyContent.test(listing.contact.website) ? "" : listing.contact.website,
    },
    isDemo: true, isPreview: false, demoLabel: "Demo/Testprofil", verification: undefined,
  };
}

// The verified legacy photos remain presentation fallbacks until replaced by
// provider-specific uploads. Database rows and their new media stay canonical.
export function withLegacyImages(listing: Listing): Listing {
  const source = reiseportalPreview.find((item) => item.slug === listing.slug);
  const imported = importedJoomlaMedia[listing.slug];
  if (!source && !imported) return listing;
  const fallback = imported ?? source;
  return { ...listing,
    directoryPackage: source?.directoryPackage ?? listing.directoryPackage,
    logo: listing.logo ?? fallback.logo,
    images: listing.images.length ? listing.images : fallback.images };
}

export async function loadReiseportalDirectory() {
  const result = await loadPublicCompanyDirectory();
  if (result.error !== null) return {
    preview: [] as Listing[],
    database: [] as Listing[],
    hiddenOrderKeys: [] as string[],
    error: result.error,
  };
  const demo = result.data.listings.map(publicDemo).find((item) => item !== null);
  let assignments: Map<string, string[]> | null;
  try {
    assignments = await loadPublicTravelAssignments();
  } catch {
    return { preview: [] as Listing[], database: [] as Listing[], hiddenOrderKeys: [] as string[],
      error: "Die Reisethemen konnten nicht geladen werden." };
  }
  const database = result.data.listings.filter(travelVisible).map((listing) => withLegacyImages({
    ...listing,
    ...(assignments ? { travelTermKeys: assignments.get(listing.id) ?? [] } : {}),
  }));
  const shown = new Set(database.map(directoryItemKey));
  const hiddenOrderKeys = result.data.orderRows
    .slice().sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => row.item_key ?? (row.demo_slug ? `demo:${row.demo_slug}` : `profile:${row.profile_id}`))
    .filter((key) => !shown.has(key));
  for (const profile of result.data.listings.filter((listing) => !travelVisible(listing))) {
    const key = directoryItemKey(profile);
    if (!hiddenOrderKeys.includes(key)) hiddenOrderKeys.push(key);
  }
  return { preview: demo ? [demo] : [], database, hiddenOrderKeys, error: null };
}

export async function loadReiseportalFeatured(slugs: readonly string[]) {
  const directory = await loadReiseportalDirectory();
  const bySlug = new Map(directory.database.map((listing) => [listing.slug, listing]));
  return slugs.flatMap((slug) => {
    const listing = bySlug.get(slug);
    return listing ? [listing] : [];
  });
}

export async function loadReiseportalTheme(theme: string) {
  const directory = await loadReiseportalDirectory();
  return directory.database.filter((listing) => filterTravelDiscovery([listing], "", theme).length > 0);
}

export async function loadReiseportalListingBySlug(slug: string) {
  if (slug === demoSourceSlug) return { data: null, error: null };
  const result = await loadPublicCompanyBySlug(slug === demoPublicSlug ? demoSourceSlug : slug);
  if (slug === demoPublicSlug) return { data: result.data ? publicDemo(result.data) : null, error: result.error };
  return result.data && !travelVisible(result.data)
    ? { data: null, error: null }
    : { data: result.data ? withLegacyImages(result.data) : null, error: result.error };
}
