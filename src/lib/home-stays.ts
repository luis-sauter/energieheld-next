import type { Listing } from '@/types/portal';
import { selectAutumnStays } from './autumn-showcase';
import { orderMottoItems } from './motto-rows';
import { providerCardImage } from './provider-card-media';

// Existing editorial card selections, visually checked against cached operator
// originals (840–1800 px). These are preferences, never publication overrides.
const reviewedImages = new Set([
  'd8567002-150a-46fb-acd1-242b7eba8c55', // SkyView Chalets
  'd18139ff-71fd-4bee-8817-29427191f43b', // Dachsteinkönig
  '1f633238-149d-4748-8f8d-4008e3ffa83b', // Camping Morteratsch
  '6377d190-91cd-4748-acfb-33694bd712b1', // Lech Lodge
  '79b31d1a-a9ba-4314-ae29-5cc23c66e180', // Baumhaushotel Otterndorf
  '202fa047-9ac7-4526-8c35-d6b5f0d6bbad', // Burg Vital Resort
  '5a3d0ecb-50cb-4aee-9aa0-d28230c23483', // Hotel Föttinger
  'c49a8964-7f6f-48ad-96ad-16d0dc1afad0', // Hotel Belvedere Scuol
  'f3378871-2da5-4103-bc44-0a2a61c6d2c5', // Golserhof
  '419485b1-231b-46cb-be23-d7989a4b3eb5', // Camping Grubhof
  '5f7538ad-ee05-45c0-b4f7-ceee57f228a1', // Waldstätterhof
  '3b6fc077-c6dd-4f45-93b1-c40c32705d3d', // Residence Sporthof
  'b722f2f9-1a54-4b38-9af9-60069c7342ce', // Residence Weingarten
  '992d6a67-d457-40d9-a9e8-986bed9763ec', // Im Tiefenbrunn
  '880c2602-82f7-4f33-8302-5d1046b41e2b', // Camping Seiser Alm
]);

// Input is the existing approved/listed public directory, not admin drafts.
// Shuffle once on the server; keep the actual card photo, crop and media IDs.
export function selectHomeStays(publicListings: readonly Listing[], seed: string): Listing[] {
  const highlighted = new Set(selectAutumnStays([...publicListings]).map(({ listing }) => listing.id));
  const eligible = orderMottoItems(publicListings.filter(listing => {
    const image = providerCardImage(listing, 'travel');
    return !listing.isDemo && !listing.isPreview && listing.name.trim() && listing.slug &&
      listing.location.city && image?.src && image.src !== listing.logo?.src;
  }), listing => listing.id, seed);
  const additional = eligible.filter(listing => !highlighted.has(listing.id));
  const pool = additional.length >= 4 ? additional : [...additional, ...eligible.filter(listing => highlighted.has(listing.id))];
  const reviewed = pool.filter(listing => reviewedImages.has(listing.cardImageAssetId ?? providerCardImage(listing, 'travel')?.id ?? ''));
  const candidates = reviewed.length >= 6 ? reviewed : [...reviewed, ...pool.filter(listing => !reviewed.includes(listing))];
  // Reserve one place per available country before filling the row, so random
  // selection does not accidentally remove a less represented destination.
  const countries = new Set<string>();
  const diverse = candidates.filter(listing => {
    if (countries.has(listing.location.country)) return false;
    countries.add(listing.location.country); return true;
  });
  const selected = [...diverse, ...candidates.filter(listing => !diverse.includes(listing))].slice(0, 12);
  return orderMottoItems(selected, listing => listing.id, seed + ':row');
}
