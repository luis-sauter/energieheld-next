import type { TravelSearchBanner } from './travel-search-banners';

export type CreativeGeometry = { width: number; height: number };
// Includes the proven 350x120 standard format; squares/portraits stay separate.
export function searchAdFormat(geometry?: CreativeGeometry) {
  const ratio = geometry && Number.isFinite(geometry.width) && Number.isFinite(geometry.height) && geometry.width > 0 && geometry.height > 0
    ? geometry.width / geometry.height : 0;
  return { wide: ratio >= 2.4, panoramic: ratio >= 6 };
}
export function searchCreativeKey(banner: TravelSearchBanner) {
  return `${banner.banner_key}|${banner.ad.image_path ?? banner.ad.imageUrl}`;
}
// Group only AFTER advertiser selection; never select additional creatives here.
export function groupSearchAdvertisements(banners: TravelSearchBanner[], measured: Record<string, CreativeGeometry> = {}) {
  const wide: TravelSearchBanner[] = [], other: TravelSearchBanner[] = [];
  for (const banner of banners) {
    const geometry = measured[searchCreativeKey(banner)] ?? { width: banner.ad.image_width ?? 0, height: banner.ad.image_height ?? 0 };
    (searchAdFormat(geometry).wide ? wide : other).push(banner);
  }
  return { wide, other };
}
