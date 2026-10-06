import type { ActiveAd } from './ad-values';
import type { Listing } from '@/types/portal';
import type { TravelFilterValues } from './reiseportal-filter-options';
import { normalizeListingSearch } from './listings';
import { filterTravelListings } from './reiseportal-facets';

export type TravelSearchBanner = {
  banner_key: string;
  profile_id: string | null;
  postal_code: string;
  city: string;
  term_keys: string[];
  ad: ActiveAd;
};

// Input is a server-resolved public projection, never raw admin campaigns.
export function matchTravelSearchBanners(banners: TravelSearchBanner[], values: TravelFilterValues) {
  const unique = new Map<string, TravelSearchBanner>();
  for (const banner of banners) {
    // There is no proven destination field in banner search metadata.
    if (values.destination || banner.ad.suppressed || !banner.ad.imageUrl || !/^https?:\/\//i.test(banner.ad.target_url)) continue;
    if ((['theme', 'audience', 'accommodation', 'feature'] as const).some(dimension =>
      values[dimension] && !banner.term_keys.includes(`${dimension}:${values[dimension]}`))) continue;
    if (values.location && !normalizeListingSearch(`${banner.city} ${banner.postal_code}`).includes(normalizeListingSearch(values.location))) continue;
    if (!unique.has(banner.banner_key)) unique.set(banner.banner_key, banner);
  }
  return [...unique.values()].sort((a,b) => a.banner_key.localeCompare(b.banner_key, 'de'));
}
export function travelSearchResults(listings: Listing[], banners: TravelSearchBanner[], values: TravelFilterValues) {
  const normal = filterTravelListings(listings, { ...values, query: '' });
  const matched = matchTravelSearchBanners(banners, values);
  return { listings: normal, banners: matched, count: normal.length + matched.length };
}
export type TravelResult = { kind: 'listing'; listing: Listing } | { kind: 'banner'; banner: TravelSearchBanner };
// Preserve listing order and package boundaries. Standalone ads are spread evenly;
// a safely associated creative always follows its listing, regardless of sort.
export function interleaveTravelResults(listings: Listing[], banners: TravelSearchBanner[]): TravelResult[] {
  const ids = new Set(listings.map(row => row.id));
  const standalone = banners.filter(row => !row.profile_id || !ids.has(row.profile_id));
  if (!listings.length) return standalone.map(banner => ({kind: 'banner', banner}));
  return listings.flatMap((listing,index) => {
    const result: TravelResult[] = [{kind:'listing',listing}, ...banners.filter(row => row.profile_id === listing.id).map(banner => ({kind:'banner' as const,banner}))];
    const start = Math.floor(index * standalone.length / listings.length);
    const end = Math.floor((index + 1) * standalone.length / listings.length);
    return [...result, ...standalone.slice(start,end).map(banner => ({kind:'banner' as const,banner}))];
  });
}
