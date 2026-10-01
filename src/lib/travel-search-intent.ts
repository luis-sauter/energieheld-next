import { travelFilterUrl } from './reiseportal-facets';
import type { TravelFilterValues } from './reiseportal-filter-options';
import { searchQuery } from './portal-search-values';

export type TravelSearchOrigin = 'home' | 'directory';
export function travelSearchUrl(values: TravelFilterValues, origin: TravelSearchOrigin) {
  const query = searchQuery(values.query);
  if (!query) return travelFilterUrl({ ...values, query: '' });
  const params = new URLSearchParams(travelFilterUrl(values).split('?')[1]);
  params.set('q', query);
  params.set('von', origin);
  return `/suche?${params}`;
}
export function travelSearchReturnUrl(values: TravelFilterValues, origin: unknown) {
  const directory = travelFilterUrl(values);
  return origin === 'home' ? directory.replace('/unterkuenfte-a-z', '/') : directory;
}
