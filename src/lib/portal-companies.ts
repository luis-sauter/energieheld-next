import "server-only";
import { listings } from "@/data/listings";
import type { Listing } from "@/types/portal";
import {
  loadPublicCompanies,
  loadPublicCompanyBySlug,
} from "./public-companies";

// Static examples supplement a successful public read; they never mask errors.
const demoProfiles = listings.filter((listing) => listing.isDemo);

export function combinePortalCompanies(companies: Listing[]): Listing[] {
  const ids = new Set(companies.map((company) => company.id));
  const slugs = new Set(companies.map((company) => company.slug));
  return [
    ...companies,
    ...demoProfiles.filter(
      (demo) => !ids.has(demo.id) && !slugs.has(demo.slug),
    ),
  ];
}

export async function loadPortalCompanies() {
  const result = await loadPublicCompanies();
  if (result.error !== null) return result;
  return { data: combinePortalCompanies(result.data), error: null };
}

export async function loadPortalCompanyBySlug(slug: string) {
  const result = await loadPublicCompanyBySlug(slug);
  if (result.error !== null || result.data) return result;
  return {
    data: demoProfiles.find((demo) => demo.slug === slug) ?? null,
    error: null,
  };
}
