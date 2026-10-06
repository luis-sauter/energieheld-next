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
  advertiser_key?: string;
  advertiser_name?: string;
  commercial?: boolean;
  primary_creative?: boolean;
  destination_slugs?: string[];
  region?: string;
  ad: ActiveAd;
};

// Input is a server-resolved public projection, never raw admin campaigns.
export function matchTravelSearchBanners(banners: TravelSearchBanner[], values: TravelFilterValues) {
  const unique = new Map<string, TravelSearchBanner>();
  for (const banner of banners) {
    if ((values.destination && !banner.destination_slugs?.includes(values.destination)) || banner.ad.suppressed || !banner.ad.imageUrl || !/^https?:\/\//i.test(banner.ad.target_url)) continue;
    if ((['theme', 'audience', 'accommodation', 'feature'] as const).some(dimension =>
      values[dimension] && !banner.term_keys.includes(`${dimension}:${values[dimension]}`))) continue;
    if (values.location && !normalizeListingSearch(`${banner.city} ${banner.postal_code} ${banner.region ?? ""}`).includes(normalizeListingSearch(values.location))) continue;
    if (!unique.has(banner.banner_key)) unique.set(banner.banner_key, banner);
  }
  return [...unique.values()].sort((a,b) => a.banner_key.localeCompare(b.banner_key, 'de'));
}
// Match each creative independently: never combine incomplete metadata across creatives.
export function selectBestAdvertiserCreative(creatives: TravelSearchBanner[], values: TravelFilterValues) {
  const active = Boolean(values.destination || values.theme || values.audience || values.accommodation || values.feature || values.location);
  return [...creatives].sort((a, b) => {
    const specificity = (row: TravelSearchBanner) => row.term_keys.length + (row.destination_slugs?.length ?? 0);
    return (active ? specificity(a) - specificity(b) : 0) || Number(Boolean(b.primary_creative)) - Number(Boolean(a.primary_creative)) || a.banner_key.localeCompare(b.banner_key, 'de');
  })[0];
}
export function travelSearchAdvertisers(banners: TravelSearchBanner[], values: TravelFilterValues) {
  const groups = new Map<string, TravelSearchBanner[]>();
  for (const banner of matchTravelSearchBanners(banners, values)) {
    let url: URL;
    try { url = new URL(banner.ad.target_url); } catch { continue; }
    if (banner.commercial === false || /(^|\.)das-reiseportal\.com$/i.test(url.hostname)) continue;
    const key = banner.profile_id ? `profile:${banner.profile_id}` : banner.advertiser_key || `unassigned:${banner.banner_key}`;
    groups.set(key, [...(groups.get(key) ?? []), banner]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, 'de')).map(([advertiser_key, creatives]) => ({ ...selectBestAdvertiserCreative(creatives, values), advertiser_key }));
}
export function travelSearchResults(listings: Listing[], banners: TravelSearchBanner[], values: TravelFilterValues) {
  const normal = filterTravelListings(listings, { ...values, query: '' });
  const advertisers = travelSearchAdvertisers(banners, values);
  return { listings: normal, advertisers, banners: advertisers, count: normal.length + advertisers.length };
}
