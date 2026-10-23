import { loadBasicMapLocations } from '@/lib/basic-map-locations';
import { basicIntegrationEnabled } from '@/lib/basic-public-search';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
type MapData = { total: number; points: number[][] };
// Coalesce overlapping anonymous reads only. No completed result is cached:
// the next request still sees withdrawals and changed address fingerprints.
let inFlight: Promise<MapData> | undefined;
export async function GET(request: Request) {
  if (new URL(request.url).search) return Response.json({ error: 'Ungültige Kartenanfrage.' }, { status: 400, headers });
  if (!basicIntegrationEnabled()) return Response.json({ error: 'Karte nicht verfügbar.' }, { status: 404, headers });
  try {
    if (!inFlight) {
      const pending = loadBasicMapLocations({ strict: true, signal: AbortSignal.timeout(20000) })
        .then(rows => ({ total: rows.length, points: rows.map(row => [row.lat, row.lon]) }));
      inFlight = pending;
      // Clear success and failure, without creating a detached rejected promise.
      void pending.then(() => { if (inFlight === pending) inFlight = undefined; },
        () => { if (inFlight === pending) inFlight = undefined; });
    }
    return Response.json(await inFlight, { headers });
  } catch {
    return Response.json({ error: 'Die Kartenstandorte konnten nicht geladen werden.' }, { status: 503, headers });
  }
}
