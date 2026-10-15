import type { Listing } from '@/types/portal';
import { providerCardImage } from './provider-card-media';
import { SPECIAL_TOPIC_TERM } from './travel-editorial';

export const AUTUMN_TERM = 'theme:saison-herbst';
// Seasonal/editorial keys remain internal; use the existing public directory.
export const AUTUMN_HREF = '/unterkuenfte-a-z';

// Editorial selection from existing, visually checked provider galleries.
// IDs select existing media, never create a second gallery or sign more URLs.
export const autumnSelections = [
  { profileId: '027d641f-c71d-402b-a5f3-aa6b293bf602', imageId: '4ccd718c-4545-4b7a-b13b-5ae3a3a5ab21', alt: 'Holzhaus zwischen Bäumen im Naturhotel Lüsnerhof' },
  { profileId: '6cd02ae2-75ab-4273-8cd8-fc62da38b2db', imageId: '8a30bccc-94e4-4b57-9f20-668a8e354c57', alt: 'Bootshaus am Teich im Hofgut Hafnerleiten' },
  { profileId: '36716652-fed2-4758-bb13-81880bbaa33d', imageId: '1d39ea4b-6d3d-4b37-830f-9e6a02fe28c0', alt: 'Entspannen am Wasser im Lake Spa Hotel SEELEITEN' },
  { profileId: '02ffb4a9-087f-40af-8c0e-5c0f85f7b27c', imageId: 'abe0970f-ca17-4f4b-97c7-a52aad2d3d9a', alt: 'Panoramahotel Oberjoch vor der Allgäuer Berglandschaft' },
] as const;

// Input is the existing public directory: approved/listed rows only. The season
// and curated gallery IDs do not grant eligibility. Keep the four-card limit.
export function selectAutumnStays(publicListings: readonly Listing[]) {
  const seen = new Set<string>();
  const eligible = publicListings.filter(listing => {
    if (seen.has(listing.id) || listing.isDemo || listing.isPreview || !listing.travelTermKeys?.includes(SPECIAL_TOPIC_TERM)) return false;
    seen.add(listing.id);
    return true;
  });
  const rank = (id: string) => {
    const index = autumnSelections.findIndex(selection => selection.profileId === id);
    return index < 0 ? autumnSelections.length : index;
  };
  return eligible.sort((a, b) => rank(a.id) - rank(b.id)).flatMap(listing => {
    const selection = autumnSelections.find(row => row.profileId === listing.id);
    const curated = selection && listing.images.find(row => row.id === selection.imageId && row.src && row.src !== listing.logo?.src);
    const image = curated ? { ...curated, alt: selection.alt } : providerCardImage(listing, 'travel');
    return image?.src && image.src !== listing.logo?.src ? [{ listing, image }] : [];
  }).slice(0, 4);
}
