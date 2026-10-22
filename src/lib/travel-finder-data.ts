import type { Listing } from '@/types/portal';
import type { TravelSearchBanner } from './travel-search-banners';

// The finder uses public identities, locations and assignments; free text is
// resolved by the existing server endpoint, never by a downloaded photo gallery.
export function travelFinderListings(listings: Listing[]): Listing[] {
  return listings.map(listing => ({
    id: listing.id, slug: listing.slug, name: listing.name, initials: '',
    tagline: '', description: '', categoryIds: listing.categoryIds, services: [], images: [],
    travelTermKeys: listing.travelTermKeys, importedAt: listing.importedAt,
    location: { city: listing.location.city, postalCode: listing.location.postalCode,
      region: listing.location.region, country: listing.location.country },
    contact: { email: '', phone: '', website: '' }, isDemo: listing.isDemo, isPreview: listing.isPreview,
  }));
}

export function travelFinderBanners(banners: TravelSearchBanner[]): TravelSearchBanner[] {
  return banners.map(banner => ({
    banner_key: banner.banner_key, profile_id: banner.profile_id,
    advertiser_key: banner.advertiser_key, commercial: banner.commercial,
    primary_creative: banner.primary_creative, postal_code: banner.postal_code, city: banner.city,
    region: banner.region, destination_slugs: banner.destination_slugs, term_keys: banner.term_keys,
    ad: { id: banner.ad.id, placement: banner.ad.placement, headline: '', image_path: null,
      body_text: null, suppressed: banner.ad.suppressed, target_url: banner.ad.target_url,
      imageUrl: banner.ad.imageUrl ? 'public-creative' : undefined },
  }));
}
