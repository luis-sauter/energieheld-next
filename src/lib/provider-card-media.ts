import type { Listing, PortalImage } from '@/types/portal';

// Select from existing provider media, never from advertising or inferred names.
// Called before legacy galleries are merged so genuine saved photos retain priority.
export function providerTravelImage(listing: Listing, legacyPhoto?: PortalImage & { excludedSavedPaths?: string[] }): PortalImage | null {
  return listing.images.find(image => image.src !== listing.logo?.src &&
    !legacyPhoto?.excludedSavedPaths?.some(path => image.src.split('?')[0].endsWith('/' + path))) ??
    legacyPhoto ?? null;
}

// One presentation decision: Basic directory rows intentionally keep their icon.
// Travel cards are independent of package and may show a verified provider photo.
export function providerCardImage(listing: Listing, context: 'directory' | 'travel'): PortalImage | undefined {
  if (context === 'directory') return listing.directoryPackage === 'basic' ? undefined :
    listing.directoryImage ?? listing.logo ?? listing.images[0];
  return listing.travelImage === undefined ? listing.images.find(image => image.src !== listing.logo?.src) :
    listing.travelImage ?? undefined;
}
