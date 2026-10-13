import Image from 'next/image';
import { travelNews } from '@/data/travel-news';
import styles from './travel-news.module.css';

export function TravelNews() {
  return <section className={styles.section} aria-labelledby="inspiration-title">
    <div className="container">
      <header className={styles.heading}>
        <p className="eyebrow">Entdecken</p>
        <h2 id="inspiration-title">Reise-News &amp; Inspiration</h2>
        <p>Aktuelle Entwicklungen, Reisetrends und Tipps für Ihre nächste Auszeit.</p>
      </header>
      <div className={styles.grid} data-travel-news>
        {travelNews.map(item => <a key={item.id} className={`${styles.card}${item.featured ? ` ${styles.lead}` : ''}`}
          href={item.sourceUrl} target="_blank" rel="noopener noreferrer" data-news-id={item.id}>
          <div className={styles.media}>
            <Image src={item.image} alt={item.imageAlt} fill loading="lazy" unoptimized
              sizes={item.featured ? '(max-width: 760px) calc(100vw - 32px), (max-width: 1200px) 58vw, 760px' : '(max-width: 760px) calc(100vw - 32px), (max-width: 1200px) 36vw, 460px'} />
            <span className={styles.category}>{item.category}</span>
          </div>
          <div className={styles.body}>
            <h3>{item.title}</h3><p className={styles.teaser}>{item.teaser}</p>
            <p className={styles.source}>{item.source} · {item.dateLabel} <time dateTime={item.publishedAt}>{item.publishedAt.split('-').reverse().join('.')}</time></p>
            <span className={styles.cta}>Bei der Quelle weiterlesen <span aria-hidden="true">↗</span><span className={styles.visuallyHidden}> (öffnet in einem neuen Tab)</span></span>
            <small className={styles.credit}>{item.imageCredit}</small>
          </div>
        </a>)}
      </div>
    </div>
  </section>;
}
