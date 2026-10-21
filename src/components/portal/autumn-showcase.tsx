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
        <h2 id="autumn-title">Jahreszeiten mit Charakter</h2>
        <p>Goldene Herbsttage, winterliche Auszeiten und besondere Orte für jede Saison.</p>
      </header>
      <div className={styles.layout}>
        <aside className={styles.editorial} aria-label="Inspiration für Ihre saisonale Auszeit">
          <Image src="/reiseportal/seasons/herbst-auszeit.webp" alt="Goldenes Herbstlaub an einem ruhigen Bergsee" fill sizes="(max-width: 900px) 90vw, 360px" loading="lazy" />
          <div className={styles.editorialCopy}>
            <div className={styles.seasonBadges}><span className={styles.badge}><TravelThemeIcon slug="natur-pur" /> Herbst</span>
              <Link className={styles.badge} href="/mottoreisen/skifahren"><TravelThemeIcon slug="skifahren" /> Winter &amp; Skiurlaub</Link></div>
            <h3>Besondere Tage.<br />Zu jeder Jahreszeit.</h3>
            <p>Wenn die Wälder leuchten oder die Berge ihr Winterkleid tragen, ist Zeit für eine besondere Auszeit. Entdecken Sie ausgewählte Gastgeber für Naturmomente, Erholung und aktive Tage im Schnee.</p>
            <ul className={styles.ideas} aria-label="Saisonale Inspiration">
              <li><TravelThemeIcon slug="wellnessangebote" /> Wellness &amp; Genuss</li>
              <li><TravelThemeIcon slug="wanderurlaub" /> Wandern &amp; Natur</li>
              <li><TravelThemeIcon slug="urlaub-am-wasser" /> Wasser &amp; Ruhe</li>
              <li><TravelThemeIcon slug="skifahren" /><Link href="/mottoreisen/skifahren">Winter &amp; Skiurlaub entdecken</Link></li>
            </ul>
            <Link href={AUTUMN_HREF} className={styles.cta}>Alle Unterkünfte entdecken <span aria-hidden="true">→</span></Link>
          </div>
        </aside>
        <ThemeScroller count={stays.length} label="Sonderthemen-Unterkünfte" edgeNavigation pageSize={4} autoPlay={false}>
          {stays.map(({ listing, image }) => <article className={styles.card} key={listing.id} data-autumn-profile={listing.id} data-editorial-term={SPECIAL_TOPIC_TERM}>
            <Link href={`/unterkuenfte/${listing.slug}`} className={styles.cardLink} aria-label={`${listing.name} – Unternehmensprofil ansehen`}>
              <div className={styles.photo}><Image src={image.src} alt={image.alt} fill unoptimized={image.src.startsWith('http')} loading="lazy" sizes="(max-width: 600px) 90vw, (max-width: 900px) 44vw, 30vw" /></div>
              <div className={styles.copy}>
                <h3>{listing.name}</h3>
                <p className={styles.location}>{[listing.location.city, listing.location.country].filter(Boolean).join(' · ')}</p>
                <ul className={styles.seasonBadges} aria-label="Belegte Saisonangebote">
                  {listing.travelTermKeys?.includes('theme:saison-herbst') && <li className={styles.badge}>Herbst</li>}
                  {listing.travelTermKeys?.includes('theme:saison-winter') && <li className={styles.badge}>Winter</li>}
                  {listing.travelTermKeys?.includes('theme:skifahren') && <li className={styles.badge}>Skiurlaub</li>}
                </ul>
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
