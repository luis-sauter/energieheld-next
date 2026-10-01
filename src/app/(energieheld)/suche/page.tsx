import Link from 'next/link';
import type { Metadata } from 'next';
import { searchPortal } from '@/lib/portal-search';
import { searchTypes, SEARCH_PAGE_SIZE, SEARCH_QUERY_LIMIT } from '@/lib/portal-search-values';
import styles from './search.module.css';

export const metadata: Metadata = { title: 'Portalsuche', robots: { index: false, follow: true } };
export const dynamic = 'force-dynamic';
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const result = await searchPortal(params.q, { type: params.typ, page: params.seite });
  const href = (page: number) => `/suche?${new URLSearchParams({ q: result.query, ...(result.type ? { typ: result.type } : {}), seite: String(page) })}`;
  return <main id="hauptinhalt" className={`container ${styles.page}`}>
    <p className="eyebrow">DAS Reiseportal</p><h1>Portalsuche</h1>
    <p>Unterkünfte, Reiseziele, Mottoreisen und Inhalte im gesamten Portal finden.</p>
    <form action="/suche" method="get" role="search" aria-label="Portalsuche" className={styles.form}>
      <div><label htmlFor="portal-query">Suchbegriff</label><input id="portal-query" name="q" type="search" defaultValue={result.query} maxLength={SEARCH_QUERY_LIMIT} placeholder="Zum Beispiel Österreich oder Wellness Bayern" /></div>
      <div><label htmlFor="portal-type">Ergebnistyp</label><select id="portal-type" name="typ" defaultValue={result.type ?? ''}><option value="">Alle Inhalte</option>
        {Object.entries(searchTypes).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
      <button type="submit" className="button button-primary">Suchen</button>
    </form>
    <p>Passende Unterkünfte strukturiert filtern? <Link className="text-link" href="/unterkuenfte-a-z">Zum Reisefinder →</Link></p>
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
