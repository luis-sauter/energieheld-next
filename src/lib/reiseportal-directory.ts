import "server-only";
import { reiseportalPreview } from "@/data/reiseportal-preview";
import type { Listing } from "@/types/portal";
import { directoryItemKey } from "./company-directory-order";
import { loadPublicCompanyBySlug, loadPublicCompanyDirectory } from "./public-companies";

const demoSourceSlug = "energieheld-demo-gmbh-c3351d59";
const demoProfileId = "31ae7d1e-26a7-4161-8d14-f5ee4735f5d4";
const oldEnergyContent = /energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung/i;

// Phase 1 has no travel taxonomy in Supabase. Keep energy-category profiles and
// energy copy out of the public travel directory until the Joomla import exists.
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
    slug: "demo-gmbh", name: "Demo GmbH", initials: "DG",
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

export async function loadReiseportalDirectory() {
  const result = await loadPublicCompanyDirectory();
  if (result.error !== null) return {
    preview: reiseportalPreview,
    database: [] as Listing[],
    hiddenOrderKeys: [] as string[],
    error: result.error,
  };
  const demo = result.data.listings.map(publicDemo).find((item) => item !== null);
  const database = result.data.listings.filter(travelVisible);
  const shown = new Set(database.map(directoryItemKey));
  const hiddenOrderKeys = result.data.orderRows
    .slice().sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => row.item_key ?? (row.demo_slug ? `demo:${row.demo_slug}` : `profile:${row.profile_id}`))
    .filter((key) => !shown.has(key));
  for (const profile of result.data.listings.filter((listing) => !travelVisible(listing))) {
    const key = directoryItemKey(profile);
    if (!hiddenOrderKeys.includes(key)) hiddenOrderKeys.push(key);
  }
  return { preview: demo ? [...reiseportalPreview, demo] : reiseportalPreview, database, hiddenOrderKeys, error: null };
}

export async function loadReiseportalListingBySlug(slug: string) {
  const preview = reiseportalPreview.find((listing) => listing.slug === slug);
  if (preview) return { data: preview, error: null };
  if (slug === demoSourceSlug) return { data: null, error: null };
  const result = await loadPublicCompanyBySlug(slug === "demo-gmbh" ? demoSourceSlug : slug);
  if (slug === "demo-gmbh") return { data: result.data ? publicDemo(result.data) : null, error: result.error };
  return result.data && !travelVisible(result.data)
    ? { data: null, error: null }
    : result;
}
