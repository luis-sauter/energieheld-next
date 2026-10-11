import { createClient } from '@/lib/supabase/server';
import { mediaLibraryPage } from '@/lib/media-library-server';
import { readMediaLibraryRequest } from '@/lib/media-library-request';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie' };
  const args = readMediaLibraryRequest(new URL(request.url).searchParams);
  if (!args) return Response.json({ items: [], count: 0, error: 'Ungültige Katalogabfrage.' }, { status: 400, headers });
  try {
    // Existing server-verified admin gate and caller's RLS; no privileged client.
    const result = await mediaLibraryPage(await createClient(), args.profile, args.kind, args.query, args.page, args.archived, request.signal);
    return Response.json(result, { status: result.error === 'Keine Berechtigung.' ? 403 : result.error && !result.items.length ? 503 : 200, headers });
  } catch {
    return Response.json({ items: [], count: 0, error: 'Die Mediathek ist gerade nicht verfügbar. Bitte versuchen Sie es erneut.' }, { status: 503, headers });
  }
}
