import type { TravelFilterValues } from './reiseportal-filter-options';

export function portalSearchFilters(values?: TravelFilterValues) {
  return { destination: values?.destination ?? '', theme: values?.theme ?? '', audience: values?.audience ?? '',
    accommodation: values?.accommodation ?? '', location: (values?.location ?? '').trim().slice(0,120),
    sort: ['name','city','imported'].includes(values?.sort ?? '') ? values!.sort : '' };
}
export function accommodationSearchOnly(values?: TravelFilterValues) {
  return Object.values(portalSearchFilters(values)).some(Boolean);
}

