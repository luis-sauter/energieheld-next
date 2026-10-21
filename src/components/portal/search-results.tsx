import Link from './navigation-link';
import { ListingRow } from './listing-row';
import { DiscoveryCard } from './reise-overview';
import { destinations, travelThemes } from '@/data/reiseportal-discovery';
import { searchTypes, type SearchHit } from '@/lib/portal-search-values';
import type { Listing } from '@/types/portal';
import styles from '@/app/(energieheld)/suche/search.module.css';
import cardStyles from './directory-listing-rows.module.css';
import {BasicAccommodationCard} from './basic-accommodation-card';
import {BasicSourceCredit} from './basic-source-credit';
import {adTargetHref} from '@/lib/ad-values';

export function SearchResults({ hits, listings, facts, travelLabels, season }: {
  hits: SearchHit[]; listings: Listing[]; facts: Listing[]; travelLabels: Record<string, string>; season?: string;
}) {
  const cards = new Map(listings.map(listing => [listing.id, listing]));
  const fallback = new Map(facts.map(listing => [listing.id, listing]));
  return <><ol className={`${styles.results} ${cardStyles.rows}`}>{hits.map(hit => {
    const entry = hit.type === 'theme' ? travelThemes.find(entry => entry.slug === hit.id)
      : hit.type === 'destination' ? destinations.find(entry => entry.slug === hit.id) : undefined;
    const listing = cards.get(hit.id) ?? fallback.get(hit.id);
    const externalHref = hit.external ? adTargetHref(hit.url) ?? '#' : undefined;
    return <li key={`${hit.type}:${hit.id}`} data-search-result={hit.type} data-search-id={hit.id}
      className={entry ? styles.discoveryResult : styles.wideResult}>
      {hit.type !== 'ad' && hit.type !== 'accommodation' && <p className={styles.resultType}>{searchTypes[hit.type]}</p>}
      {hit.basic ? <BasicAccommodationCard entry={hit.basic}/> : hit.type === 'accommodation' ? <ListingRow listing={listing ?? {
        id: hit.id, slug: hit.url.split('/').pop() ?? '', name: hit.title,
        initials: hit.title.slice(0, 2), tagline: '', description: hit.excerpt,
        categoryIds: [], services: [], images: [], isDemo: false,
        location: { city: '', country: '', region: '', postalCode: '' },
        contact: { email: '', phone: '', website: '' },
      }} categories={[]} href={hit.url} showVerification={false} travel travelLabels={travelLabels} season={season} />
        : entry ? <DiscoveryCard entry={entry} basePath={hit.type === 'theme' ? '/mottoreisen' : '/reiseziele'}
          sizes="(max-width: 700px) 100vw, 50vw" />
          : <article className={styles.textResult}><h3>{hit.external
            ? <a href={externalHref} target={externalHref?.startsWith('/') ? undefined : '_blank'} rel="sponsored noopener noreferrer">{hit.title} ↗</a>
            : <Link href={hit.url}>{hit.title} →</Link>}</h3><p>{hit.excerpt}</p></article>}
    </li>;
  })}</ol>{hits.some(hit => hit.basic) && <BasicSourceCredit/>}</>;
}
