type ImageTarget = HTMLImageElement;
type Reference = { bucket: string; path: string; original: string };

// Only renew this project's existing image URLs, using anonymous Storage RLS.
// No session, service key, arbitrary host or permanently public bucket is needed.
export function signedImageReference(src: string, origin: string): Reference | null {
  try {
    if (/\.\.|%2e|%2f|%5c/i.test(src.split('?')[0])) return null;
    const url = new URL(src);
    if (url.origin !== origin || !url.searchParams.has('token')) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/sign\/(company-media|ad-media)\/(.+)$/);
    if (!match) return null;
    const path = decodeURIComponent(match[2]);
    if (!/^(profiles|campaigns)\/[0-9a-f-]{36}\//.test(path) ||
        (match[1] === 'company-media') !== path.startsWith('profiles/') ||
        path.split('/').some(part => !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part) || part.includes('..')) ||
        !/\.(jpg|jpeg|png|webp)$/i.test(path)) return null;
    return { bucket: match[1], path, original: src };
  } catch { return null; }
}

export function installSignedImageRecovery(doc: Document, origin: string, publishableKey: string, fetcher: typeof fetch = fetch) {
  const attempts = new WeakMap<ImageTarget, Set<string>>();
  const pending = new Map<string, Promise<string | null>>();
  const controller = new AbortController();
  let disposed = false;

  async function renew(reference: Reference): Promise<string | null> {
    const key = `${reference.bucket}/${reference.path}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const request = (async () => {
      try {
        const path = reference.path.split('/').map(encodeURIComponent).join('/');
        const response = await fetcher(`${origin}/storage/v1/object/sign/${reference.bucket}/${path}`, {
          method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
          headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: reference.bucket === 'ad-media' ? 300 : 3600 }),
        });
        if (!response.ok) return null;
        const data = await response.json();
        const relative = data.signedURL;
        if (typeof relative !== 'string') return null;
        const fresh = new URL(`/storage/v1${relative}`, origin).href;
        const checked = signedImageReference(fresh, origin);
        return checked?.bucket === reference.bucket && checked.path === reference.path ? fresh : null;
      } catch { return null; }
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  }

  async function recover(image: ImageTarget) {
    const original = image.currentSrc || image.src;
    const reference = signedImageReference(original, origin);
    if (!reference) return;
    const tried = attempts.get(image) ?? new Set<string>();
    // Two independent failures per element at most; never an error/retry loop.
    if (tried.has(original) || tried.size >= 2) return;
    tried.add(original); attempts.set(image, tried);
    const fresh = await renew(reference);
    if (disposed || !fresh || (image.currentSrc || image.src) !== original || !image.isConnected) return;
    // A responsive banner may have selected its <source>, rather than img.src.
    const sources = image.parentElement?.tagName === 'PICTURE'
      ? [...image.parentElement.querySelectorAll('source')] : [];
    for (const source of sources) if (source.srcset === original) source.srcset = fresh;
    if (image.srcset === original) image.srcset = fresh;
    if (image.src === original) image.src = fresh;
  }

  const onError = (event: Event) => {
    const target = event.target as ImageTarget | null;
    if (target?.tagName === 'IMG') void recover(target);
  };
  doc.addEventListener('error', onError, true);
  // Include failures which happened before hydration; unrequested lazy images
  // have complete=false and are deliberately left lazy.
  for (const image of doc.images) if (image.complete && image.naturalWidth === 0) void recover(image);
  return () => { disposed = true; controller.abort(); doc.removeEventListener('error', onError, true); };
}
