import { TravelSignals } from "@/components/portal/travel-signals";
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { searchPortal } from '@/lib/portal-search';
import { searchTypes, SEARCH_PAGE_SIZE } from '@/lib/portal-search-values';
import styles from './search.module.css';
import { readTravelFilterValues } from '@/lib/reiseportal-filter-options';
import { SearchTravelFinder } from '@/components/portal/travel-finder';
import { loadReiseportalFinderListings } from '@/lib/reiseportal-directory';
import { loadPublicTravelTerms } from '@/lib/public-travel-taxonomy';
import { travelSearchReturnUrl, travelSearchUrl } from '@/lib/travel-search-intent';

export const metadata = pageMetadata({ title: 'Suchergebnisse', description: 'Öffentliche Inhalte im DAS Reiseportal durchsuchen und passende Seiten entdecken.', noindex: true });
export const dynamic = 'force-dynamic';
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [result, finder] = await Promise.all([searchPortal(params.q, { type: params.typ, page: params.seite }),
    Promise.all([loadReiseportalFinderListings(), loadPublicTravelTerms()]).then(([listings, terms]) => ({ listings, terms, error: null as string | null }))
      .catch(() => ({ listings: [], terms: [], error: "Die Reisefilter sind gerade nicht verfügbar. Die Freitextsuche bleibt möglich." }))]);
  const values = { ...readTravelFilterValues(params), query: result.query };
  const origin = params.von === 'home' ? 'home' : 'directory';
  const context = new URLSearchParams(travelSearchUrl(values, origin).split('?')[1]);
  const href = (page: number) => { const next = new URLSearchParams(context); if (result.type) next.set('typ', result.type); next.set('seite', String(page)); return `/suche?${next}`; };
  return <main id="hauptinhalt">
    <SearchTravelFinder key={JSON.stringify(values)} listings={finder.listings} terms={finder.terms} initialValues={values} origin={origin} error={finder.error} />
    <div className={`container ${styles.page}`}>
    <Link className="text-link" href={travelSearchReturnUrl(values, origin)}>← Zur Suche zurück</Link>
    <p>Ergebnisse aus dem gesamten Reiseportal. Ihre Reisefilter bleiben für die Rückkehr zur Suche erhalten.</p>
    <nav className={styles.types} aria-label="Ergebnistyp">
      {[['', 'Alle Inhalte'], ...Object.entries(searchTypes)].map(([key, label]) => {
        const next = new URLSearchParams(context); if (key) next.set('typ', key);
        return <Link key={key} href={`/suche?${next}`} aria-current={(result.type ?? '') === key ? 'page' : undefined}>{label}</Link>;
      })}
    </nav>
    {result.error ? <div className="empty-state" role="alert">{result.error}</div>
      : !result.query ? <p className="empty-state">Geben Sie einen Suchbegriff ein.</p>
      : <section aria-labelledby="search-results"><h2 id="search-results">{result.total} {result.total === 1 ? 'Ergebnis' : 'Ergebnisse'} für „{result.query}“</h2>
        {!result.total && <p className="empty-state">Keine passenden Inhalte gefunden. Versuchen Sie einen anderen Suchbegriff.</p>}
        <ol className={styles.results}>{result.hits.map(hit => <li key={`${hit.type}:${hit.id}`}>
          <article><p className="eyebrow">{searchTypes[hit.type]}</p><h3>
            {hit.external ? <a href={hit.url} target="_blank" rel="sponsored noopener noreferrer">{hit.title} ↗</a> : <Link href={hit.url}>{hit.title} →</Link>}
          </h3>{hit.type === "accommodation" && <TravelSignals termKeys={finder.listings.find(listing => listing.id === hit.id)?.travelTermKeys} />}<p>{hit.excerpt}</p></article>
        </li>)}</ol>
        {result.total > SEARCH_PAGE_SIZE && <nav aria-label="Ergebnisseiten" className={styles.pagination}>
          {result.page > 1 && <Link className="button" href={href(result.page - 1)}>← Vorherige</Link>}
          <span>Seite {result.page}</span>
          {result.page < 50 && result.page * SEARCH_PAGE_SIZE < result.total && <Link className="button" href={href(result.page + 1)}>Nächste →</Link>}
        </nav>}
      </section>}
    </div>
  </main>;
}
