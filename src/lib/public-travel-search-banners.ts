import 'server-only';
import { cache } from 'react';
import { createPublicClient } from './supabase/public';
import { signAdImages } from './ad-campaigns';
import { publicBannerCreatives, type BannerSearchData, type SearchAdSource, type SearchPresentation } from './portal-search-banners';
import type { TravelSearchBanner } from './travel-search-banners';

type Metadata = BannerSearchData & { term_keys: string[]; profile_id: string | null };
export const loadTravelSearchBanners = cache(async (): Promise<{banners: TravelSearchBanner[]; error: string | null}> => {
  try {
    const client = createPublicClient();
    const {data,error} = await client.rpc('public_travel_search_banners');
    if (error || !data) throw Error('Public banners unavailable');
    const payload = data as { ads: SearchAdSource[]; presentations: SearchPresentation[]; metadata: Metadata[] };
    // Sign each unique public creative once. Invalid/missing media remains suppressed,
    // rather than resurrecting the historical fallback beneath a booked campaign.
    const eligible = payload.ads.filter(ad => ad.image_available && ad.image_path?.startsWith(`campaigns/${ad.id}/creative/`));
    const signed = await signAdImages(client, eligible);
    const urls = new Map(signed.map(ad => [ad.image_path,ad.imageUrl]));
    const ads = payload.ads.map(ad => ({...ad,imageUrl: urls.get(ad.image_path),image_available: Boolean(urls.get(ad.image_path))}));
    const unique = new Map<string, TravelSearchBanner>();
    for (const {ad,identity,details} of publicBannerCreatives(ads,payload.presentations,payload.metadata)) {
      if (!ad.imageUrl || ad.imageUrl === 'public-creative' || !details || unique.has(identity)) continue;
      const metadata = details as Metadata;
      unique.set(identity,{banner_key:identity,profile_id:metadata.profile_id,postal_code:metadata.postal_code,city:metadata.city,term_keys:metadata.term_keys,ad:{...ad,headline:metadata.name}});
    }
    return {banners:[...unique.values()],error:null};
  } catch {
    return {banners:[],error:'Die Anzeigen für diese Suche konnten nicht geladen werden. Bitte laden Sie die Seite erneut.'};
  }
});
