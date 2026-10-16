import 'server-only';
import { createPublicClient } from './supabase/public';
import { portalAdSections } from './ad-target-areas';
import { portalSearchCatalog } from './portal-search-catalog';
import { legacySearchCatalog, publicBannerSearch, type SearchAdSource, type SearchPresentation, type BannerSearchData } from './portal-search-banners';
import { searchResultBatch, type SearchCursor, searchResultPage, searchExcerpt, searchQuery, searchType, SEARCH_PAGE_SIZE, queryWords, type SearchHit, type SearchType } from './portal-search-values';
import type { TravelFilterValues } from './reiseportal-filter-options';
import {basicIntegrationEnabled,searchMixedAccommodations} from './basic-public-search';

import { portalSearchFilters, accommodationSearchOnly } from './portal-search-filters';
export { portalSearchFilters, accommodationSearchOnly } from './portal-search-filters';

type SearchResponse = { total: number; hits: Omit<SearchHit, 'type'>[]; catalog_hits: SearchHit[]; ads: SearchAdSource[]; presentations: SearchPresentation[]; banner_metadata?: BannerSearchData[] };
export type SearchResult = { query: string; type?: SearchType; page: number; total: number; accommodationTotal: number; hits: SearchHit[]; nextCursor?: SearchCursor | null; error?: string };
// Provider boundary: the server page consumes only SearchResult, never Supabase rows.
export async function searchPortal(value: unknown, options: { type?: unknown; page?: unknown; filters?: TravelFilterValues; cursor?: SearchCursor; countOnly?: boolean; signal?: AbortSignal } = {}): Promise<SearchResult> {
  if(basicIntegrationEnabled())return searchMixedAccommodations(value,options,async()=>{
    const request=createPublicClient().rpc('search_public_portal_v2',{p_query:searchQuery(value),p_limit:1,p_offset:0,p_areas:portalAdSections.flatMap(s=>s.areas.map(a=>a.key)),p_catalog:[...portalSearchCatalog(),...legacySearchCatalog()],p_filters:portalSearchFilters(options.filters)});
    const {data,error}=await(options.signal?request.abortSignal(options.signal):request);
    if(error||!data)throw Error('Public catalog unavailable');
    const result=data as SearchResponse;
    return [...result.catalog_hits.filter(h=>h.type!=='ad'),...publicBannerSearch(result.ads,result.presentations,searchQuery(value),result.catalog_hits,result.banner_metadata)];
  });
  const filtered = accommodationSearchOnly(options.filters);
  const query = searchQuery(value), type = filtered ? 'accommodation' : searchType(options.type);
  const requestedPage = Number(options.page);
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(50, requestedPage)) : 1;
  const cursor = options.cursor;
  const empty = { query, type, page, total: 0, accommodationTotal: 0, hits: [] };
  if (!queryWords(query).length) return empty;
  try {
    // One bounded RPC, no full profile loader, no signing and no per-card calls.
    const request = createPublicClient().rpc('search_public_portal_v2', {
      p_query: query, p_limit: options.countOnly ? 1 : cursor || filtered ? SEARCH_PAGE_SIZE : page * SEARCH_PAGE_SIZE, p_offset: options.countOnly ? 0 : cursor ? cursor.profiles : filtered ? (page-1)*SEARCH_PAGE_SIZE : 0,
      p_areas: portalAdSections.flatMap(section => section.areas.map(area => area.key)),
      p_catalog: [...portalSearchCatalog(), ...legacySearchCatalog()],
      p_filters: portalSearchFilters(options.filters),
    });
    const { data, error } = await (options.signal ? request.abortSignal(options.signal) : request);
    if (error || !data) throw new Error('Public search unavailable');
    const result = data as SearchResponse;
    const profiles: SearchHit[] = options.countOnly ? [] : result.hits.map(hit => ({ ...hit, type: 'accommodation', excerpt: searchExcerpt(hit.excerpt, query) }));
    // Filter/count/order happen before the bounded DB prefix. Preserve that order.
    if (filtered) return { query, type, page, total: result.total, accommodationTotal: result.total, hits: profiles, ...(cursor ? {nextCursor: cursor.profiles+profiles.length < result.total && profiles.length ? {profiles:cursor.profiles+profiles.length,other:0} : null} : {}) };
    const otherHits = [...result.catalog_hits.filter(hit => hit.type !== 'ad'), ...publicBannerSearch(result.ads, result.presentations, query, result.catalog_hits, result.banner_metadata)];
    // Count the same canonical/deduplicated public hits as the actual result page.
    // No profile hydration, signing or result cards are needed for the preview.
    if(options.countOnly) return {query,type,page,accommodationTotal:result.total,total:searchResultPage([],otherHits,result.total,type,1).total,hits:[]};
    if(cursor) return {query,type,page,accommodationTotal:result.total,...searchResultBatch(profiles,otherHits,result.total,type,cursor)};
    return { query, type, page, accommodationTotal: result.total, ...searchResultPage(profiles, otherHits, result.total, type, page) };
  } catch {
    // Never present an incomplete list as the complete portal search.
    return { ...empty, error: 'Die Portalsuche ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.' };
  }
}
