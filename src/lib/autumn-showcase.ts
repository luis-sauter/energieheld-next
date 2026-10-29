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

// Existing, approved ski hosts. This only selects gallery images and ordering;
// the persisted Sonderthema assignment is still required for every card.
export const winterSelections = [
  { profileId: '97578023-61cb-43f8-b650-676f3baa7777', imageId: '78aa643e-4c21-4065-a92d-08faea744c37', alt: 'Wintersport beim Hotel Steiner in Obertauern' },
  { profileId: '9a1a97da-2aad-439c-973d-8416ef4b4345', imageId: '82443757-3085-4f1b-93bf-8be3f9955f6a', alt: 'Hotel Schneider im Schnee in Obertauern' },
  { profileId: '4a740b14-2efb-44de-a472-f4f135d01cf0', imageId: '341f8ef3-ef2a-4dd1-aff6-021e4a9c1c0c', alt: 'Außenansicht des Hotel Franks in Oberstdorf' },
  { profileId: 'a6249a1b-7890-45f9-9765-1c937144c114', imageId: 'b4e67472-2cad-4b8b-9867-7a9e4f6b6a89', alt: 'The Cambrian in Adelboden' },
  { profileId: '0c8598b3-a2d2-45ad-bcbb-e19c4ee80e84', imageId: 'c2953588-2143-43c5-b335-47529d1018a5', alt: 'Außenansicht des JOAS guesthouse in Innichen' },
] as const;
const seasonalSelections = [autumnSelections[0], winterSelections[0], autumnSelections[1], winterSelections[1], ...autumnSelections.slice(2), ...winterSelections.slice(2)];

// Input is the existing public directory: approved/listed rows only. The season
// and curated gallery IDs do not grant eligibility. All eligible cards remain
// reachable in the carousel; the viewport, not the selection, limits visibility.
export function selectAutumnStays(publicListings: readonly Listing[]) {
  const seen = new Set<string>();
  const eligible = publicListings.filter(listing => {
    if (seen.has(listing.id) || listing.isDemo || listing.isPreview || !listing.travelTermKeys?.includes(SPECIAL_TOPIC_TERM)) return false;
    seen.add(listing.id);
    return true;
  });
  const rank = (id: string) => {
    const index = seasonalSelections.findIndex(selection => selection.profileId === id);
    return index < 0 ? seasonalSelections.length : index;
  };
  return eligible.sort((a, b) => rank(a.id) - rank(b.id)).flatMap(listing => {
    const selection = seasonalSelections.find(row => row.profileId === listing.id);
    const curated = selection && listing.images.find(row => row.id === selection.imageId && row.src && row.src !== listing.logo?.src);
    const saved = listing.cardImageAssetId ? providerCardImage(listing, 'travel') : undefined;
    const image = saved ?? (curated ? { ...curated, alt: selection.alt } : providerCardImage(listing, 'travel'));
    return image?.src && image.src !== listing.logo?.src ? [{ listing, image, crop: saved ? listing.cardImageCrop : undefined, assetId: saved ? listing.cardImageAssetId : undefined }] : [];
  });
}
