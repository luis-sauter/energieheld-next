import styles from './europe-map.module.css';

// Deliberately a fixed image: visiting Home must not fetch or render map points.
export function StaticHomeMap() {
  return <section className={styles.section} aria-labelledby="locations-title" data-company-map>
    <div className="container">
      <header className={styles.header}>
        <h2 id="locations-title">Unsere Unterkünfte im Überblick</h2>
        <p>Entdecken Sie unsere Unterkünfte und ihre Standorte in Deutschland, Österreich, der Schweiz und Südtirol.</p>
        <a href="/unterkuenfte-a-z" className={styles.link}>Alle Unterkünfte entdecken <span aria-hidden="true">→</span></a>
      </header>
      <div className={styles.frame}>
        {/* Already compressed at double display resolution; no image-transform request needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.snapshot} src="/reiseportal/maps/accommodations-overview.webp" width={2480} height={1098}
          loading="lazy" decoding="async" alt="Kartenübersicht der Unterkunftsstandorte in Deutschland, Österreich, der Schweiz und Südtirol" />
      </div>
      <div className={styles.footnote}>
        <p className={styles.credit}>Karte: <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> · Standorte: Betreiberangaben, Bad Birnbach Tourismus, © swisstopo / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap-Mitwirkende</a></p>
      </div>
    </div>
  </section>;
}
