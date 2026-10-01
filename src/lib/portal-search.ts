import 'server-only';
import { createPublicClient } from './supabase/public';
import { portalAdSections } from './ad-target-areas';
import { portalSearchCatalog } from './portal-search-catalog';
import { legacySearchCatalog, publicBannerSearch, type SearchAdSource, type SearchPresentation } from './portal-search-banners';
import { searchResultPage, searchExcerpt, searchQuery, searchType, SEARCH_PAGE_SIZE, queryWords, type SearchHit, type SearchType } from './portal-search-values';

type SearchResponse = { total: number; hits: Omit<SearchHit, 'type'>[]; catalog_hits: SearchHit[]; ads: SearchAdSource[]; presentations: SearchPresentation[] };
export type SearchResult = { query: string; type?: SearchType; page: number; total: number; hits: SearchHit[]; error?: string };
// Provider boundary: the server page consumes only SearchResult, never Supabase rows.
export async function searchPortal(value: unknown, options: { type?: unknown; page?: unknown } = {}): Promise<SearchResult> {
  const query = searchQuery(value), type = searchType(options.type);
  const requestedPage = Number(options.page);
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(50, requestedPage)) : 1;
  const empty = { query, type, page, total: 0, hits: [] };
  if (!queryWords(query).length) return empty;
  try {
    // One bounded RPC, no full profile loader, no signing and no per-card calls.
    const { data, error } = await createPublicClient().rpc('search_public_portal', {
      p_query: query, p_limit: page * SEARCH_PAGE_SIZE, p_offset: 0,
      p_areas: portalAdSections.flatMap(section => section.areas.map(area => area.key)),
      p_catalog: [...portalSearchCatalog(), ...legacySearchCatalog()],
    });
    if (error || !data) throw new Error('Public search unavailable');
    const result = data as SearchResponse;
    const profiles: SearchHit[] = result.hits.map(hit => ({ ...hit, type: 'accommodation', excerpt: searchExcerpt(hit.excerpt, query) }));
    const otherHits = [...result.catalog_hits.filter(hit => hit.type !== 'ad'), ...publicBannerSearch(result.ads, result.presentations, query, result.catalog_hits)];
    return { query, type, page, ...searchResultPage(profiles, otherHits, result.total, type, page) };
  } catch {
    // Never present an incomplete list as the complete portal search.
    return { ...empty, error: 'Die Portalsuche ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.' };
  }
}
