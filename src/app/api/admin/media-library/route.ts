import { createClient } from '@/lib/supabase/server';
import { mediaLibraryPage, type MediaLibraryTimings } from '@/lib/media-library-server';
import { readMediaLibraryRequest } from '@/lib/media-library-request';

export async function GET(request: Request) {
  const start = performance.now();
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
  const args = readMediaLibraryRequest(new URL(request.url).searchParams);
  if (!args) return Response.json({ items: [], count: 0, error: 'Ungültige Katalogabfrage.' }, { status: 400, headers });
  try {
    // Existing server-verified admin gate and caller's RLS; no privileged client.
    const timings: MediaLibraryTimings = {};
    const result = await mediaLibraryPage(await createClient(), args.profile, args.kind, args.query, args.page, args.archived, request.signal, timings);
    const response = Response.json(result, { status: result.error === 'Keine Berechtigung.' ? 403 : result.error && !result.items.length ? 503 : 200, headers });
    // Durations only, on successful authorized reads: no IDs, paths, tokens or global state.
    // catalog_rpc includes PostgREST/network; server_total excludes the proxy/CDN/client.
    if (response.status === 200 && !result.error) {
      const spans = [timings.access, timings.catalog_rpc, timings.signing];
      if (spans.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
        response.headers.set('Server-Timing', `access;dur=${timings.access!.toFixed(1)}, catalog_rpc;dur=${timings.catalog_rpc!.toFixed(1)}, signing;dur=${timings.signing!.toFixed(1)}, server_total;dur=${(performance.now() - start).toFixed(1)}, read_retries;desc="${timings.read_retries ?? 0}"`);
      }
    }
    return response;
  } catch {
    return Response.json({ items: [], count: 0, error: 'Die Mediathek ist gerade nicht verfügbar. Bitte versuchen Sie es erneut.' }, { status: 503, headers });
  }
}
