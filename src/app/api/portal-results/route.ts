import { readTravelFilterValues } from '@/lib/reiseportal-filter-options';
import { readSearchCursor } from '@/lib/portal-search-values';
import { loadPublicDirectoryIndex, loadPublicDirectoryFacts, directoryWindows, hydrateDirectoryWindow, hydrateBannerWindow, loadSearchBatch } from '@/lib/public-result-pages';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const params = Object.fromEntries(query);
  if (!['directory', 'search'].includes(params.kind) ||
      ['offset', 'profiles', 'other'].some(key => query.has(key) && (!/^(0|[1-9]\d{0,4})$/.test(query.get(key)!) || Number(query.get(key))>10000)))
    return Response.json({ error: 'Ungültige Folgeseite.' }, { status: 400, headers });
  const values = readTravelFilterValues(params);
  try {
    if (params.kind === 'search') {
      const loaded = await loadSearchBatch(params, values, readSearchCursor(params.profiles ?? 0, params.other ?? 0));
      return Response.json(loaded.batch, { headers });
    }
    if (!['profiles', 'banners'].includes(params.stream)) return Response.json({ error: 'Ungültiger Datenstrom.' }, { status: 400, headers });
    const offset = Number(params.offset ?? 0);
    if (offset > 10000) return Response.json({ error: 'Ungültige Folgeseite.' }, { status: 400, headers });
    const index = params.stream==='banners'?await loadPublicDirectoryIndex(false):{facts:await loadPublicDirectoryFacts(),ads:[],banners:[],terms:[],error:null};
    if(params.stream==='banners' && index.error) throw Error('Banners unavailable');
    const windows = directoryWindows(index, values, offset, offset);
    const batch = params.stream === 'banners' ? await hydrateBannerWindow(windows.advertisements)
      : await hydrateDirectoryWindow(windows.profiles, index.facts);
    return Response.json(batch, { headers });
  } catch {
    return Response.json({ error: 'Weitere Ergebnisse konnten nicht geladen werden.' }, { status: 503, headers });
  }
}
