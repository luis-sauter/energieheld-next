import "server-only";
import { cache } from "react";
import { loadReiseportalListingBySlug } from "./reiseportal-directory";
import { loadPublicProfileTravelTerms } from "./public-travel-taxonomy";
import { indexableProfile } from "./seo";
import type { PublicTravelTerm } from "./reiseportal-filter-options";

// Only deduplicate within one SSR request (Metadata + page), never across users.
export const loadAccommodationPage = cache(async (slug: string) => {
  const result = await loadReiseportalListingBySlug(slug);
  let terms: PublicTravelTerm[] = [];
  if (result.data && indexableProfile(result.data)) {
    try { terms = await loadPublicProfileTravelTerms(result.data.id); }
    catch { /* A missing taxonomy must not hide the existing public profile. */ }
  }
  return { ...result, data: result.data ? { ...result.data, travelTermKeys: terms.map(term => term.term_key) } : null, terms };
});
