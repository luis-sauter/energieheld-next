// Only the existing project's signed images may use the private image endpoint.
export const MEDIA_WIDTHS = [96, 192, 384, 640, 960, 1280, 1920] as const;
export function mediaWidth(width: number) {
  return MEDIA_WIDTHS.find(value => value >= width) ?? 1920;
}
export function isSignedPortalImage(src: string) {
  try {
    const url = new URL(src);
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
    return url.protocol === 'https:' && url.origin === origin && !url.username && !url.password &&
      /^\/storage\/v1\/object\/sign\/(company-media|ad-media)\//.test(url.pathname) && url.searchParams.has('token');
  } catch { return false; }
}
export function mediaImageUrl(src: string, width: number) {
  return isSignedPortalImage(src) ? `/api/portal-image?src=${encodeURIComponent(src)}&w=${mediaWidth(width)}` : src;
}
export function mediaImageAttributes(src: string | undefined, sizes = '100vw') {
  return src && isSignedPortalImage(src) ? {
    src: mediaImageUrl(src, 960),
    srcSet: MEDIA_WIDTHS.filter(width => width >= 384).map(width => `${mediaImageUrl(src, width)} ${width}w`).join(', '), sizes: `auto, ${sizes}`,
  } : { src };
}
export function unwrapMediaImage(src: string) {
  try {
    const url = new URL(src, 'https://portal.invalid');
    return url.pathname === '/api/portal-image' && isSignedPortalImage(url.searchParams.get('src') ?? '')
      ? url.searchParams.get('src')! : src;
  } catch { return src; }
}
export function renewMediaAttribute(value: string, previous: string, fresh: string) {
  return value.split(',').map(part => {
    const [src, descriptor] = part.trim().split(/\s+/);
    let replacement = src;
    if (src === previous) replacement = fresh;
    else if (unwrapMediaImage(src) === previous) {
      const url = new URL(src, 'https://portal.invalid'); url.searchParams.set('src', fresh);
      replacement = src.startsWith('http') ? url.href : `${url.pathname}${url.search}`;
    }
    return `${replacement}${descriptor ? ` ${descriptor}` : ''}`;
  }).join(', ');
}
