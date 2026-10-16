import 'server-only';
import { createPublicClient } from './supabase/public';
import { loadDirectoryPackages, publicDemo, loadReiseportalDirectoryFacts, loadReiseportalFinderListings, loadReiseportalSearchListings } from './reiseportal-directory';
import { sortByDirectoryOrder, type DirectoryOrderRow } from './company-directory-order';
import { withPublicImportMarkers } from './public-profile-imports';
import { withSavedCardImages } from './profile-card-images';
import { loadPublicAds } from './public-ads';
import { loadTravelSearchBanners } from './public-travel-search-banners';
import { travelSearchResults } from './travel-search-banners';
import { filterTravelListings } from './reiseportal-facets';
import { directoryBannerPool } from './directory-banner-layout';
import { signAdImages } from './ad-campaigns';
import type { ActiveAd } from './ad-values';
import type { TravelFilterValues } from './reiseportal-filter-options';
import type { Listing } from '@/types/portal';

import {compactResultCard} from './portal-search-values';
export {compactResultCard} from './portal-search-values';
import type { SearchCursor, SearchHit } from './portal-search-values';
import {loadAccommodationPage,readAccommodationCursor} from './basic-public-search';
import type {DirectoryEntry} from './basic-contact';

export async function loadBasicDirectoryWindow(values:TravelFilterValues,cursor='',basicsOnly=false,signal?:AbortSignal){
  const page=await loadAccommodationPage('',values,readAccommodationCursor(cursor),{basicsOnly,signal});
  const ids=page.items.flatMap(row=>row.entry.kind==='profile'?[row.entry.id]:[]);
  const assignments=ids.length?await createPublicClient().from('company_profile_travel_terms').select('profile_id,term_key,seasonal_teaser').in('profile_id',ids):{data:[],error:null};
  if(assignments.error)throw Error('Travel assignments unavailable');
  const cards=await loadReiseportalSearchListings(ids,[]);
  const byId=new Map(cards.map(card=>[card.id,card]));
  const items:DirectoryEntry[]=page.items.map(({entry})=>{
    if(entry.kind==='basic')return entry;
    const original=byId.get(entry.id),card=original&&entry.url==='/unterkuenfte/demo-gmbh'?publicDemo(original):original;if(!card)throw Error('Public profile changed; reload');
    const terms=(assignments.data??[]).filter(t=>t.profile_id===card.id);
    return compactResultCard({...card,travelTermKeys:terms.map(t=>t.term_key),seasonTeasers:Object.fromEntries(terms.filter(t=>t.seasonal_teaser).map(t=>[t.term_key,t.seasonal_teaser!]))});
  });
  return {items,total:page.total,nextCursor:page.hasMore&&page.items.length?JSON.stringify(page.items.at(-1)!.after):null};
}

export type SearchItem = { hit: SearchHit; listing?: Listing };
export const RESULT_BATCH_SIZE = 20;
export function resultWindow<T>(rows: T[], offset: number) {
  const items = rows.slice(offset, offset + RESULT_BATCH_SIZE);
  const next = offset + items.length;
  return { items, total: rows.length, nextCursor: items.length && next < rows.length ? next : null };
}

export async function loadPublicDirectoryFacts() {
  const client = createPublicClient();
  const orderPromise = (async () => {
    const rows: DirectoryOrderRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await client.from('company_directory_order').select('profile_id,sort_order')
        .order('profile_id').range(offset, offset + 499);
      if (page.error) throw Error('Directory order unavailable');
      rows.push(...(page.data ?? []));
      if ((page.data?.length ?? 0) < 500) return rows;
    }
  })();
  const [facts, packages, order] = await Promise.all([
    loadReiseportalDirectoryFacts(), loadDirectoryPackages(),
    orderPromise,
  ]);
  const ordered = [...facts.filter(row => row.isDemo), ...sortByDirectoryOrder(facts.filter(row => !row.isDemo), order)];
  return withPublicImportMarkers(ordered.map(row => ({ ...row,
    directoryPackage: row.isDemo ? 'basic' : packages.get(row.id) ?? 'basic' })));
}

export async function loadPublicDirectoryIndex(includeFacts = true) {
  const [facts, ads, bannerData] = await Promise.all([
    includeFacts ? loadPublicDirectoryFacts() : Promise.resolve([]), loadPublicAds(undefined, 'directory', undefined, false), loadTravelSearchBanners(false),
  ]);
  return { facts, ads, ...bannerData };
}

export function directoryWindows(index: Awaited<ReturnType<typeof loadPublicDirectoryIndex>>, values: TravelFilterValues, offset = 0, bannerOffset = 0) {
  const filters = { ...values, query: '', location: '' };
  const rows = filterTravelListings(index.facts, filters);
  const ordered = [...rows.filter(row => row.directoryPackage === 'premium'), ...rows.filter(row => row.directoryPackage !== 'premium')];
  const advertisers = travelSearchResults(index.facts, index.banners, filters).advertisers;
  return {
    profiles: resultWindow(ordered, offset),
    advertisements: resultWindow(directoryBannerPool([...index.ads, ...advertisers.map(row => row.ad)]), bannerOffset),
  };
}

export async function hydrateDirectoryWindow(window: ReturnType<typeof resultWindow<Listing>>, facts: Listing[]) {
  const loaded = await withSavedCardImages(await loadReiseportalSearchListings(window.items.map(row => row.id), facts));
  const byId = new Map(loaded.map(row => [row.id, row]));
  return { ...window, items: window.items.flatMap(fact => {
    const loadedRow = byId.get(fact.id); const row=loadedRow && (fact.isDemo?publicDemo(loadedRow):loadedRow); return row ? [compactResultCard({ ...row, travelTermKeys:fact.travelTermKeys, importedAt: fact.importedAt })] : [];
  }) };
}

export async function hydrateBannerWindow(window: ReturnType<typeof resultWindow<ActiveAd>>) {
  const client = createPublicClient();
  const campaigns = window.items.filter(row => row.image_path);
  const signed = await signAdImages(client, campaigns);
  if(signed.some(row=>!row.imageUrl))throw Error('Banner preview unavailable');
  const byId = new Map(signed.map(row => [row.id, row]));
  return { ...window, items: window.items.map(row => byId.get(row.id) ?? row).filter(row => row.imageUrl && row.imageUrl !== 'public-creative') };
}

export async function loadSearchBatch(params: Record<string, string | string[] | undefined>, values: TravelFilterValues, cursor: SearchCursor, facts?: Listing[],signal?:AbortSignal) {
  const {searchPortal}=await import("./portal-search");
  const result = await searchPortal(params.q, { type: params.typ, filters: values, cursor,signal });
  if (result.error) throw new Error(result.error);
  const ids=result.hits.filter(hit=>hit.type==='accommodation'&&!hit.basic).map(hit=>hit.id);
  const metadata = facts ?? (ids.length ? await loadReiseportalFinderListings(true) : []);
  const cards = await loadReiseportalSearchListings(ids, metadata);
  const byId = new Map(cards.map(card => [card.id, card]));
  return { result, batch: { items: result.hits.map(hit => ({ hit, listing: byId.has(hit.id)?compactResultCard(byId.get(hit.id)!):undefined })), total: result.total, nextCursor: result.nextCursor ?? null } };
}
