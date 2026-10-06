import type { BannerSearchMetadata } from './banner-search-metadata';

export function appendBannerSearchAssignment(form: FormData, value: BannerSearchMetadata) {
  form.set('banner_advertiser',value.advertiser_key ?? ''); form.set('banner_advertiser_name',value.advertiser_name ?? '');
  form.set('banner_profile_id',value.advertiser_profile_id ?? ''); form.set('banner_commercial',String(value.commercial !== false));
  form.set('banner_primary',String(Boolean(value.primary_creative))); form.set('banner_region',value.region ?? '');
  (value.destination_slugs ?? []).forEach(slug => form.append('banner_destinations',slug));
}
