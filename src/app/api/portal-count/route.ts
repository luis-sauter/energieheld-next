import { readTravelFilterValues } from '@/lib/reiseportal-filter-options';
import { portalSearchFilters } from '@/lib/portal-search-filters';
import { queryWords, searchQuery } from '@/lib/portal-search-values';
import { createPublicClient } from '@/lib/supabase/public';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  if (Object.entries(params).some(([key,value]) => value.length > (key === 'q' ? 160 : 80)))
    return Response.json({error:'Ungültige Suche.'},{status:400,headers});
  const values = readTravelFilterValues(params);
  const query = searchQuery(values.query);
  // Match the existing provider's empty/stopword semantics, including one-letter queries.
  if (!queryWords(query).length) return Response.json({total:0},{headers});
  try {
    const {data,error} = await createPublicClient().rpc('search_public_portal_v2', {
      p_query:query, p_limit:1, p_offset:0, p_areas:[], p_catalog:[],
      // Existing accommodation-only branch skips banner contexts. Ordering cannot
      // change membership/count; name also avoids import-metadata work.
      p_filters:{...portalSearchFilters(values),sort:'name'},
    }).abortSignal(request.signal);
    if (error || !data || !Number.isSafeInteger(data.total) || data.total < 0) throw Error('Unavailable');
    return Response.json({total:data.total},{headers});
  } catch {
    return Response.json({error:'Die Trefferzahl ist gerade nicht verfügbar.'},{status:503,headers});
  }
}
