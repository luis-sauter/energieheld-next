import Image from 'next/image';
import Link from './navigation-link';
import { TravelSignals } from './travel-signals';
import { TravelThemeIcon } from './travel-theme-icon';
import { ThemeScroller } from './theme-scroller';
import { AUTUMN_HREF, selectAutumnStays } from '@/lib/autumn-showcase';
import { SPECIAL_TOPIC_TERM } from '@/lib/travel-editorial';
import type { Listing } from '@/types/portal';
import styles from './autumn-showcase.module.css';

export function AutumnShowcase({ listings }: { listings: readonly Listing[] }) {
  const stays = selectAutumnStays(listings);
  if (!stays.length) return null;
  return <section className={styles.section} aria-labelledby="autumn-title" data-autumn-showcase>
    <div className="container">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Jetzt passend zur Saison</p>
        <h2 id="autumn-title">Herbst-Auszeit mit Charakter</h2>
        <p>Besondere Orte für goldene Tage, ruhige Naturmomente und wohltuende Erholung.</p>
      </header>
      <div className={styles.layout}>
        <aside className={styles.editorial} aria-label="Inspiration für Ihre Herbst-Auszeit">
          <Image src="/reiseportal/seasons/herbst-auszeit.webp" alt="Goldenes Herbstlaub an einem ruhigen Bergsee – KI-generiertes Symbolbild" fill sizes="(max-width: 900px) 90vw, 360px" loading="lazy" />
          <div className={styles.editorialCopy}>
            <span className={styles.badge}><TravelThemeIcon slug="natur-pur" /> Herbst</span>
            <h3>Goldene Tage.<br />Zeit für sich.</h3>
            <p>Wenn die Wälder leuchten und die Tage ruhiger werden, ist Raum für eine besondere Auszeit. Entdecken Sie ausgewählte Herbst-Unterkünfte für Naturmomente, Genuss und Erholung.</p>
            <ul className={styles.ideas} aria-label="Herbst-Inspiration">
              <li><TravelThemeIcon slug="wellnessangebote" /> Wellness &amp; Genuss</li>
              <li><TravelThemeIcon slug="wanderurlaub" /> Wandern &amp; Natur</li>
              <li><TravelThemeIcon slug="urlaub-am-wasser" /> Wasser &amp; Ruhe</li>
            </ul>
            <Link href={AUTUMN_HREF} className={styles.cta}>Alle Unterkünfte entdecken <span aria-hidden="true">→</span></Link>
          </div>
          <small className={styles.caption}>KI-generiertes Symbolbild</small>
        </aside>
        <ThemeScroller count={stays.length} label="Sonderthemen-Unterkünfte" edgeNavigation pageSize={4} autoPlay={false}>
          {stays.map(({ listing, image }) => <article className={styles.card} key={listing.id} data-autumn-profile={listing.id} data-editorial-term={SPECIAL_TOPIC_TERM}>
            <Link href={`/unterkuenfte/${listing.slug}`} className={styles.cardLink} aria-label={`${listing.name} – Unternehmensprofil ansehen`}>
              <div className={styles.photo}><Image src={image.src} alt={image.alt} fill unoptimized={image.src.startsWith('http')} loading="lazy" sizes="(max-width: 600px) 90vw, (max-width: 900px) 44vw, 30vw" /></div>
              <div className={styles.copy}>
                <h3>{listing.name}</h3>
                <p className={styles.location}>{[listing.location.city, listing.location.country].filter(Boolean).join(' · ')}</p>
                <TravelSignals termKeys={listing.travelTermKeys?.filter(key => key.startsWith('theme:') && !key.startsWith('theme:saison-'))} limit={2} />
                <span className={styles.arrow} aria-hidden="true">→</span>
              </div>
            </Link>
          </article>)}
        </ThemeScroller>
      </div>
    </div>
  </section>;
}
