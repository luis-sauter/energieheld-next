import "server-only";
import { reiseportalPreview } from "@/data/reiseportal-preview";
import type { Listing } from "@/types/portal";
import { directoryItemKey } from "./company-directory-order";
import { loadPublicCompanyBySlug, loadPublicCompanyDirectory } from "./public-companies";

const excludedTestSlug = "energieheld-demo-gmbh-c3351d59";
const oldEnergyContent = /energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung/i;

// Phase 1 has no travel taxonomy in Supabase. Keep energy-category profiles and
// energy copy out of the public travel directory until the Joomla import exists.
function travelVisible(listing: Listing) {
  return listing.slug !== excludedTestSlug && listing.categoryIds.length === 0 &&
    !oldEnergyContent.test([listing.name, listing.tagline, listing.description, listing.businessAreas].join(" "));
}

export async function loadReiseportalDirectory() {
  const result = await loadPublicCompanyDirectory();
  if (result.error !== null) return {
    preview: reiseportalPreview,
    database: [] as Listing[],
    hiddenOrderKeys: [] as string[],
    error: result.error,
  };
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
  return { preview: reiseportalPreview, database, hiddenOrderKeys, error: null };
}

export async function loadReiseportalListingBySlug(slug: string) {
  const preview = reiseportalPreview.find((listing) => listing.slug === slug);
  if (preview) return { data: preview, error: null };
  if (slug === excludedTestSlug) return { data: null, error: null };
  const result = await loadPublicCompanyBySlug(slug);
  return result.data && !travelVisible(result.data)
    ? { data: null, error: null }
    : result;
}
