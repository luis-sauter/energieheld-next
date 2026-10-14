'use client';

import type { Listing } from '@/types/portal';
import type { SearchCursor } from '@/lib/portal-search-values';
import type { SearchItem } from '@/lib/public-result-pages';
import { useResultStream, type ResultBatch } from './use-result-stream';
import { AutoLoad } from './auto-load';
import { SearchResults } from './search-results';

export function SearchResultStream({ initial, context, facts, travelLabels, season }: {
  initial: ResultBatch<SearchItem, SearchCursor>; context: string; facts: Listing[]; travelLabels: Record<string, string>; season?: string;
}) {
  const stream = useResultStream({ initial, firstCursor: { profiles: 0, other: 0 },
    itemKey: (item: SearchItem) => `${item.hit.type}:${item.hit.id}`,
    url: (cursor: SearchCursor) => {
      const params = new URLSearchParams(context); params.set('kind', 'search');
      params.set('profiles', String(cursor.profiles)); params.set('other', String(cursor.other));
      return `/api/portal-results?${params}`;
    } });
  return <><SearchResults hits={stream.items.map(item => item.hit)} listings={stream.items.flatMap(item => item.listing ? [item.listing] : [])}
    facts={facts} travelLabels={travelLabels} season={season} />
    <AutoLoad hasMore={stream.nextCursor !== null} loading={stream.loading} error={stream.error} load={stream.load} /></>;
}
