import type { Listing } from '@/types/portal';

export const AUTUMN_TERM = 'theme:saison-herbst';
export const AUTUMN_HREF = '/unterkuenfte-a-z?thema=saison-herbst';

// Editorial selection from existing, visually checked provider galleries.
// IDs select existing media, never create a second gallery or sign more URLs.
export const autumnSelections = [
  { profileId: '027d641f-c71d-402b-a5f3-aa6b293bf602', imageId: '4ccd718c-4545-4b7a-b13b-5ae3a3a5ab21', alt: 'Holzhaus zwischen Bäumen im Naturhotel Lüsnerhof' },
  { profileId: '6cd02ae2-75ab-4273-8cd8-fc62da38b2db', imageId: '8a30bccc-94e4-4b57-9f20-668a8e354c57', alt: 'Bootshaus am Teich im Hofgut Hafnerleiten' },
  { profileId: '36716652-fed2-4758-bb13-81880bbaa33d', imageId: '1d39ea4b-6d3d-4b37-830f-9e6a02fe28c0', alt: 'Entspannen am Wasser im Lake Spa Hotel SEELEITEN' },
  { profileId: '02ffb4a9-087f-40af-8c0e-5c0f85f7b27c', imageId: 'abe0970f-ca17-4f4b-97c7-a52aad2d3d9a', alt: 'Panoramahotel Oberjoch vor der Allgäuer Berglandschaft' },
] as const;

// Input is the existing public directory: approved/listed rows only. Fail closed
// if an assignment, genuine selected image or profile is no longer available.
export function selectAutumnStays(publicListings: readonly Listing[]) {
  return autumnSelections.flatMap(selection => {
    const listing = publicListings.find(row => row.id === selection.profileId);
    if (!listing || listing.isDemo || listing.isPreview || !listing.travelTermKeys?.includes(AUTUMN_TERM)) return [];
    const image = listing.images.find(row => row.id === selection.imageId && row.src && row.src !== listing.logo?.src);
    return image ? [{ listing, image: { ...image, alt: selection.alt } }] : [];
  });
}
