import "server-only";
import { listings } from "@/data/listings";
import type { Listing } from "@/types/portal";
import {
  loadPublicCompanyDirectory,
  loadPublicCompanyBySlug,
} from "./public-companies";
import { sortByDirectoryOrder, type DirectoryOrderRow } from "./company-directory-order";

// Static examples supplement a successful public read; they never mask errors.
const demoProfiles = listings.filter((listing) => listing.isDemo);

export function combinePortalCompanies(companies: Listing[], orderRows?: DirectoryOrderRow[]): Listing[] {
  const ids = new Set(companies.map((company) => company.id));
  const slugs = new Set(companies.map((company) => company.slug));
  const combined = [
    ...companies,
    ...demoProfiles.filter(
      (demo) => !ids.has(demo.id) && !slugs.has(demo.slug),
    ),
  ];
  return orderRows ? sortByDirectoryOrder(combined, orderRows) : combined;
}

export async function loadPortalCompanies() {
  const result = await loadPublicCompanyDirectory();
  if (result.error !== null) return result;
  const combined = combinePortalCompanies(result.data.listings, result.data.orderRows);
  const visibleDemos = new Set(combined.filter((item) => item.isDemo).map((item) => item.slug));
  const hiddenDemoKeys = result.data.orderRows
    .filter((row) => row.demo_slug && !visibleDemos.has(row.demo_slug))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => row.item_key ?? `demo:${row.demo_slug}`);
  return {
    data: combined,
    error: null,
    hiddenDemoKeys,
  };
}

export async function loadPortalCompanyBySlug(slug: string) {
  const result = await loadPublicCompanyBySlug(slug);
  if (result.error !== null || result.data) return result;
  return {
    data: demoProfiles.find((demo) => demo.slug === slug) ?? null,
    error: null,
  };
}
