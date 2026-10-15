import { compactResultCard } from "@/lib/portal-search-values";
import { SearchResultStream } from "@/components/portal/search-result-stream";
import Link from '@/components/portal/navigation-link';
import { pageMetadata } from '@/lib/seo';
import { searchPortal, accommodationSearchOnly } from '@/lib/portal-search';
import { searchTypes } from '@/lib/portal-search-values';
import styles from './search.module.css';
import { readTravelFilterValues } from '@/lib/reiseportal-filter-options';
import { SearchTravelFinder } from '@/components/portal/travel-finder';
import { loadReiseportalFinderListings, loadReiseportalSearchListings } from '@/lib/reiseportal-directory';
import { loadPublicTravelTerms } from '@/lib/public-travel-taxonomy';
import { travelSearchReturnUrl, travelSearchUrl } from '@/lib/travel-search-intent';

export const metadata = pageMetadata({ title: 'Suchergebnisse', description: 'Öffentliche Inhalte im DAS-Reiseportal.com durchsuchen und passende Seiten entdecken.', noindex: true });
export const dynamic = 'force-dynamic';
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initialFilters = readTravelFilterValues(params);
  const filtered = accommodationSearchOnly(initialFilters);
  const [result, finder] = await Promise.all([searchPortal(params.q, { type: params.typ, cursor: {profiles:0,other:0}, filters: initialFilters }),
    Promise.all([loadReiseportalFinderListings(true), loadPublicTravelTerms()]).then(([listings, terms]) => ({ listings, terms, error: null as string | null }))
      .catch(() => ({ listings: [], terms: [], error: "Die Reisefilter sind gerade nicht verfügbar. Die Freitextsuche bleibt möglich." }))]);
  const cards = await loadReiseportalSearchListings(result.hits.filter(hit => hit.type === 'accommodation').map(hit => hit.id), finder.listings)
    .then(listings => ({ listings, error: null as string | null }))
    .catch(() => ({ listings: [], error: 'Die Vorschaubilder sind gerade nicht verfügbar. Ihre Suchtreffer bleiben erhalten.' }));
  const values = { ...readTravelFilterValues(params), query: result.query };
  const origin = params.von === 'home' ? 'home' : 'directory';
  const context = new URLSearchParams(travelSearchUrl(values, origin).split('?')[1]);
  if (result.type) context.set('typ', result.type);
  return <main id="hauptinhalt">
    <SearchTravelFinder key={JSON.stringify(values)} listings={finder.listings} terms={finder.terms} initialValues={values} origin={origin} error={finder.error} completedSearch={{ values, total: !filtered && result.type ? undefined : result.total, error: result.error }} />
    <div className={`container ${styles.page}`}>
    <Link className="text-link" href={travelSearchReturnUrl(values, origin)}>← Zur Suche zurück</Link>
    <p>{filtered ? 'Ihre Reisefilter grenzen die Suche auf passende Unterkünfte ein. Für Reiseziele und Mottoreisen entfernen Sie die Reisefilter.' : 'Ergebnisse aus dem gesamten Reiseportal: Unterkünfte, Reiseziele und Mottoreisen.'}</p>
    <nav className={styles.types} aria-label="Ergebnistyp">
      {(filtered ? [['accommodation', 'Unterkünfte mit Ihren Reisefiltern']] : [['', 'Alle Inhalte'], ...Object.entries(searchTypes)]).map(([key, label]) => {
        const next = new URLSearchParams(context); if (key) next.set('typ', key);
        return <Link key={key} href={`/suche?${next}`} aria-current={(result.type ?? '') === key ? 'page' : undefined}>{label}</Link>;
      })}
    </nav>
    {result.error ? <div className="empty-state" role="alert">{result.error}</div>
      : !result.query ? <p className="empty-state">Geben Sie einen Suchbegriff ein.</p>
      : <section aria-labelledby="search-results"><h2 id="search-results">{result.total} {result.total === 1 ? 'Ergebnis' : 'Ergebnisse'} für „{result.query}“</h2>
        {!result.total && <p className="empty-state">Keine passenden Inhalte gefunden. Versuchen Sie einen anderen Suchbegriff.</p>}
        {cards.error && <p role="status">{cards.error}</p>}
        <SearchResultStream key={context.toString()} context={context.toString()} season={values.theme}
          initial={{items:result.hits.map(hit=>({hit,listing:cards.listings.find(row=>row.id===hit.id) ? compactResultCard(cards.listings.find(row=>row.id===hit.id)!) : undefined})),total:result.total,nextCursor:result.nextCursor??null}}
          facts={finder.listings} travelLabels={Object.fromEntries(finder.terms.map(term=>[term.term_key,term.label]))} />
      </section>}
    </div>
  </main>;
}
