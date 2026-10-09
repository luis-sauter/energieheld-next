import "server-only";
import { withSavedCardImages } from "./profile-card-images";
import { reiseportalPreview } from "@/data/reiseportal-preview";
import { importedJoomlaMedia } from "@/data/reiseportal-import-media";
import legacyDirectoryMedia from "../data/reiseportal-legacy-directory-media.json" with { type: "json" };
import verifiedProviderMedia from "../data/reiseportal-legacy-provider-media.json" with { type: "json" };
import travelPhotos from '../data/reiseportal-travel-provider-images.json' with { type: 'json' };
import type { Listing } from "@/types/portal";
import { companyProfileListing } from "./company-presentation";
import { directoryItemKey } from "./company-directory-order";
import { loadPublicCompanyBySlug, loadPublicCompanyDirectory, loadPublicCompanyProfileIndex } from "./public-companies";
import { demoProfileId, demoPublicSlug, demoSourceSlug } from "./reiseportal-demo";
import { loadPublicTravelAssignments } from "./public-travel-taxonomy";
import { filterTravelDiscovery } from "./reiseportal-search";
import { createPublicClient } from "./supabase/public";
import { providerTravelImage } from './provider-card-media';

const oldEnergyContent = /energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung/i;

// Keep energy-category profiles and energy copy out of the public travel directory.
function travelVisible(listing: Pick<Listing, "slug" | "name" | "categoryIds" | "tagline" | "description" | "businessAreas">) {
  return listing.slug !== demoSourceSlug && listing.categoryIds.length === 0 &&
    !oldEnergyContent.test([listing.name, listing.tagline, listing.description, listing.businessAreas].join(" "));
}

export async function loadReiseportalProfileIndex() {
  const rows = await loadPublicCompanyProfileIndex();
  return rows.filter(row => travelVisible({ slug: row.slug, name: row.display_name,
    tagline: row.tagline ?? "", description: row.description ?? "", businessAreas: row.business_areas ?? "",
    categoryIds: row.company_profile_categories.map(category => category.category_id) }))
    .map(row => ({ id: row.id, slug: row.slug, isDemo: false, isPreview: false }));
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
  // Older imports inherited the energy-portal default "Bayern" even when
  // Joomla recorded another country. Keep stored data intact and show that
  // recorded country until an editor supplies a real region.
  if (listing.location.region === "Bayern" && listing.location.country &&
      listing.location.country !== "Deutschland") {
    listing = { ...listing, location: { ...listing.location, region: "" } };
  }
  const source = reiseportalPreview.find((item) => item.slug === listing.slug);
  const imported = importedJoomlaMedia[listing.slug];
  const verified = (verifiedProviderMedia as Record<string, { logo?: Listing["logo"]; images: Listing["images"] }>)[listing.slug];
  const directoryImage = (legacyDirectoryMedia as Record<string, { src: string; alt: string }>)[listing.slug];
  const travelImage = providerTravelImage(listing, (travelPhotos as Record<string, NonNullable<Listing['travelImage']>>)[listing.slug]);
  if (!source && !imported && !verified && !directoryImage) return { ...listing, travelImage };
  const historicImage = directoryImage ? { src: directoryImage.src, alt: directoryImage.alt } : undefined;
  const result = { ...listing,
    travelImage,
    directoryImage: listing.logo ?? listing.images[0] ?? listing.directoryImage ??
      historicImage,
    logo: listing.logo ?? verified?.logo ?? imported?.logo ?? source?.logo ?? historicImage,
    images: listing.images.length ? listing.images : verified?.images.length ? verified.images :
      imported?.images.length ? imported.images : source?.images.length ? source.images :
      historicImage ? [historicImage] : [] };
  return result.video ? { ...result, video: { ...result.video, poster: result.images[0]?.src } } : result;
}

async function loadDirectoryPackages() {
  const client = createPublicClient();
  const packages = new Map<string, "basic" | "premium">();
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("company_profile_directory_packages")
      .select("profile_id,package").order("profile_id").range(offset, offset + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.package === "basic" || row.package === "premium") packages.set(row.profile_id, row.package);
    }
    if ((data?.length ?? 0) < pageSize) break;
  }
  return packages;
}

export async function loadReiseportalDirectory() {
  let packages: Map<string, "basic" | "premium">;
  try {
    packages = await loadDirectoryPackages();
  } catch {
    return { preview: [] as Listing[], database: [] as Listing[], hiddenOrderKeys: [] as string[],
      error: "Die Unterkunftsdarstellung konnte nicht geladen werden." };
  }
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
  const database = await withSavedCardImages(result.data.listings.filter(travelVisible).map((listing) => withLegacyImages({
    ...listing,
    directoryPackage: packages.get(listing.id) ?? "basic",
    ...(assignments ? { travelTermKeys: assignments.get(listing.id) ?? [] } : {}),
  })));
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

export async function loadReiseportalDestination(destination: string) {
  const directory = await loadReiseportalDirectory();
  return filterTravelDiscovery(directory.database, destination, "");
}

export async function loadReiseportalListingBySlug(slug: string) {
  if (slug === demoSourceSlug) return { data: null, error: null };
  const result = await loadPublicCompanyBySlug(slug === demoPublicSlug ? demoSourceSlug : slug);
  if (slug === demoPublicSlug) return { data: result.data ? publicDemo(result.data) : null, error: result.error };
  return result.data && !travelVisible(result.data)
    ? { data: null, error: null }
    : { data: result.data ? withLegacyImages(result.data) : null, error: result.error };
}

// Facet counts on the result route need facts, not images or signed media.
export async function loadReiseportalFinderListings(): Promise<Listing[]> {
  const [profiles, assignments] = await Promise.all([loadPublicCompanyProfileIndex(), loadPublicTravelAssignments()]);
  return profiles.map(profile => ({ ...companyProfileListing(profile, { images: [] }), travelTermKeys: assignments?.get(profile.id) ?? [] }))
    .filter(travelVisible);
}
