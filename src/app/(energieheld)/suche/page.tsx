import Link from 'next/link';
import type { Metadata } from 'next';
import { searchPortal } from '@/lib/portal-search';
import { searchTypes, SEARCH_PAGE_SIZE, SEARCH_QUERY_LIMIT } from '@/lib/portal-search-values';
import styles from './search.module.css';
import { readTravelFilterValues } from '@/lib/reiseportal-filter-options';
import { travelFilterParams } from '@/lib/reiseportal-facets';
import { travelSearchReturnUrl, travelSearchUrl } from '@/lib/travel-search-intent';

export const metadata: Metadata = { title: 'Suchergebnisse', robots: { index: false, follow: true } };
export const dynamic = 'force-dynamic';
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const result = await searchPortal(params.q, { type: params.typ, page: params.seite });
  const values = { ...readTravelFilterValues(params), query: result.query };
  const origin = params.von === 'home' ? 'home' : 'directory';
  const context = new URLSearchParams(travelSearchUrl(values, origin).split('?')[1]);
  const href = (page: number) => { const next = new URLSearchParams(context); if (result.type) next.set('typ', result.type); next.set('seite', String(page)); return `/suche?${next}`; };
  return <main id="hauptinhalt" className={`container ${styles.page}`}>
    <Link className="text-link" href={travelSearchReturnUrl(values, origin)}>← Zur Suche zurück</Link>
    <p className="eyebrow">DAS Reiseportal</p><h1>Suchergebnisse</h1>
    <p>Ergebnisse aus dem gesamten Reiseportal. Ihre Reisefilter bleiben für die Rückkehr zur Suche erhalten.</p>
    <form action="/suche" method="get" role="search" aria-label="Suche ändern" className={styles.form}>
      <input type="hidden" name="von" value={origin} />
      {Object.entries(travelFilterParams).filter(([key]) => key !== 'query').map(([key, name]) => values[key as keyof typeof values] && <input key={key} type="hidden" name={name} value={values[key as keyof typeof values]} />)}
      <div><label htmlFor="portal-query">Suchbegriff ändern</label><input id="portal-query" name="q" type="search" defaultValue={result.query} maxLength={SEARCH_QUERY_LIMIT} /></div>
      <div><label htmlFor="portal-type">Ergebnistyp</label><select id="portal-type" name="typ" defaultValue={result.type ?? ''}><option value="">Alle Inhalte</option>
        {Object.entries(searchTypes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
      <button type="submit" className="button button-primary">Suchen</button>
    </form>
    {result.error ? <div className="empty-state" role="alert">{result.error}</div>
      : !result.query ? <p className="empty-state">Geben Sie einen Suchbegriff ein.</p>
      : <section aria-labelledby="search-results"><h2 id="search-results">{result.total} {result.total === 1 ? 'Ergebnis' : 'Ergebnisse'} für „{result.query}“</h2>
        {!result.total && <p className="empty-state">Keine passenden Inhalte gefunden. Versuchen Sie einen anderen Suchbegriff.</p>}
        <ol className={styles.results}>{result.hits.map(hit => <li key={`${hit.type}:${hit.id}`}>
          <article><p className="eyebrow">{searchTypes[hit.type]}</p><h3>
            {hit.external ? <a href={hit.url} target="_blank" rel="sponsored noopener noreferrer">{hit.title} ↗</a> : <Link href={hit.url}>{hit.title} →</Link>}
          </h3><p>{hit.excerpt}</p></article>
        </li>)}</ol>
        {result.total > SEARCH_PAGE_SIZE && <nav aria-label="Ergebnisseiten" className={styles.pagination}>
          {result.page > 1 && <Link className="button" href={href(result.page - 1)}>← Vorherige</Link>}
          <span>Seite {result.page}</span>
          {result.page < 50 && result.page * SEARCH_PAGE_SIZE < result.total && <Link className="button" href={href(result.page + 1)}>Nächste →</Link>}
        </nav>}
      </section>}
  </main>;
}
