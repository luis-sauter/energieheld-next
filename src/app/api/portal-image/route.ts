import { privateImageRequest, privateImageRendition } from '@/lib/private-image.server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request) {
  const url = new URL(request.url);
  const src = url.searchParams.get('src') ?? '';
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const image = origin && privateImageRequest(src, Number(url.searchParams.get('w')), new URL(origin).origin);
  if (!image) return new Response('Bild nicht verfügbar.', { status: 400, headers });
  try {
    const { body, type } = await privateImageRendition(image);
    if (image.expires <= Date.now()) return new Response('Bild nicht verfügbar.', { status: 400, headers });
    return new Response(new Uint8Array(body).buffer, { headers: { ...headers, 'Content-Type': type, 'Content-Length': String(body.byteLength) } });
  } catch {
    // A busy optimizer must not make a valid original disappear. The redirect
    // target has already passed the exact-origin/path/expiry guards above.
    return new Response(null, { status: 307, headers: { ...headers, Location: image.src } });
  }
}
