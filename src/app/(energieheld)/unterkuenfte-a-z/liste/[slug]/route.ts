import { loadReiseportalListingBySlug } from '@/lib/reiseportal-directory';
import { indexableProfile } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  let slug: string;
  try { slug = decodeURIComponent((await params).slug); }
  catch { return unavailable(404); }
  // This spelling is the existing verified alias on the current profile route.
  if (slug === 'höflehner') slug = 'hoeflehner';
  try {
    const result = await loadReiseportalListingBySlug(slug);
    if (result.error) return unavailable(503);
    if (!result.data || !indexableProfile(result.data)) return unavailable(404);
    // A relative destination cannot leak Next's internal reverse-proxy hostname.
    return new Response(null, { status: 308, headers: {
      Location: `/unterkuenfte/${encodeURIComponent(result.data.slug)}`,
    } });
  } catch { return unavailable(503); }
}

function unavailable(status: 404 | 503) {
  return new Response(status === 404 ? 'Unterkunft nicht gefunden.' : 'Unterkunft derzeit nicht erreichbar.', {
    status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store', ...(status === 503 ? { 'Retry-After': '300' } : {}) },
  });
}
