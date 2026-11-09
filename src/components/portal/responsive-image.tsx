'use client';
import Image, { type ImageProps } from 'next/image';
import { isSignedPortalImage, mediaImageUrl } from '@/lib/responsive-media';

// Local assets retain Next's existing optimizer. Original URLs remain in the
// editor/gallery data; only the displayed rendition changes.
export default function ResponsiveImage(props: ImageProps) {
  const signed = typeof props.src === 'string' && isSignedPortalImage(props.src);
  return <Image {...props} alt={props.alt} onError={event => {
    const image = event.currentTarget;
    // The capturing recovery listener runs first. Do not unmount the image
    // while anonymous RLS-based renewal is still in progress.
    if (props.onError && image.hasAttribute('data-portal-image-recovering')) {
      image.addEventListener('portal-image-unavailable', () => props.onError?.(event), { once: true });
    } else props.onError?.(event);
  }} {...(signed ? {
    unoptimized: false,
    sizes: props.sizes && !(props.preload || props.priority || props.loading === 'eager') ? `auto, ${props.sizes}` : props.sizes,
    loader: ({ src, width }: { src: string; width: number }) => mediaImageUrl(src, width),
  } : {})} />;
}
