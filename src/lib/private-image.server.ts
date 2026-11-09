import 'server-only';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { signedImageReference } from './signed-image-recovery';
import { MEDIA_WIDTHS } from './responsive-media';

const MAX_INPUT = 16 * 1024 * 1024, MAX_CACHE = 32 * 1024 * 1024;
type Rendition = { body: Uint8Array; type: string };
const cache = new Map<string, Rendition & { until: number }>();
let cacheBytes = 0, active = 0;
const waiting: Array<() => void> = [];
const pending = new Map<string, Promise<Rendition>>();

export function privateImageRequest(src: string, width: number, origin: string, now = Date.now()) {
  if (src.length > 4096 || !MEDIA_WIDTHS.includes(width as typeof MEDIA_WIDTHS[number])) return null;
  const reference = signedImageReference(src, origin);
  if (!reference) return null;
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.searchParams.size !== 1) return null;
    const payload = JSON.parse(Buffer.from(url.searchParams.get('token')!.split('.')[1], 'base64url').toString());
    // This is ONLY an expiry guard, never signature verification. Supabase
    // verifies the complete bearer token before any bytes enter this cache.
    if (!Number.isSafeInteger(payload.exp) || payload.exp * 1000 <= now) return null;
    return { src, width, expires: payload.exp * 1000 };
  } catch { return null; }
}
export async function privateImageRendition(request: NonNullable<ReturnType<typeof privateImageRequest>>, fetcher: typeof fetch = fetch) {
  const key = createHash('sha256').update(`${request.src}:${request.width}`).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit;
  if (hit) { cacheBytes -= hit.body.byteLength; cache.delete(key); }
  if (pending.has(key)) return pending.get(key)!;
  if (active >= 2 && waiting.length >= 10) throw new Error('Image capacity');
  const work = (async () => {
    if (active >= 2) await new Promise<void>((resolve, reject) => {
      const resume = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        const index = waiting.indexOf(resume); if (index >= 0) waiting.splice(index, 1);
        reject(new Error('Image capacity'));
      }, 2000);
      waiting.push(resume);
    });
    else active++;
    try {
      const upstream = await fetcher(request.src, { redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(8000) });
      if (!upstream.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(upstream.headers.get('content-type') ?? '') || !upstream.body) throw new Error('Image unavailable');
      const length = Number(upstream.headers.get('content-length'));
      if (length > MAX_INPUT) { await upstream.body.cancel(); throw new Error('Image size'); }
      const chunks: Uint8Array[] = []; let size = 0;
      const reader = upstream.body.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > MAX_INPUT) throw new Error('Image size');
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const original = Buffer.concat(chunks);
      const converted = await sharp(original, { limitInputPixels: 24_000_000, sequentialRead: true })
        .rotate().resize({ width: request.width, withoutEnlargement: true })
        .webp({ quality: 85, effort: 3 }).timeout({ seconds: 4 }).toBuffer();
      const smaller = converted.byteLength < original.byteLength;
      const body = new Uint8Array(smaller ? converted : original);
      const type = smaller ? 'image/webp' : upstream.headers.get('content-type')!.split(';')[0];
      // Bounded process memory; token expiry is never extended by a cache hit.
      const now = Date.now();
      for (const [id, item] of cache) if (item.until <= now) { cacheBytes -= item.body.byteLength; cache.delete(id); }
      if (body.byteLength <= MAX_CACHE && request.expires > now) {
        while (cache.size && (cacheBytes + body.byteLength > MAX_CACHE || cache.size >= 96)) {
          const oldest = cache.keys().next().value!; cacheBytes -= cache.get(oldest)!.body.byteLength; cache.delete(oldest);
        }
        cache.set(key, { body, type, until: Math.min(request.expires, now + 60_000) }); cacheBytes += body.byteLength;
      }
      return { body, type };
    } finally { const next = waiting.shift(); if (next) next(); else active--; }
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
