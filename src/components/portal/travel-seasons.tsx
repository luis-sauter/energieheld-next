import Image from "next/image";
import { currentTravelSeason, orderedTravelSeasons } from "@/lib/travel-seasons";
import styles from "./travel-seasons.module.css";

// Server-only date decision. No client clock, prefetch, carousel or database call.
export function TravelSeasons({ date = new Date() }: { date?: Date }) {
  const current = currentTravelSeason(date);
  return <section className={styles.section} aria-labelledby="seasons-title"><div className="section container">
    <p className="eyebrow">Jede Jahreszeit hat ihren Reiz</p>
    <h2 id="seasons-title">Ihre nächste Auszeit zur richtigen Jahreszeit</h2>
    <p>Entdecken Sie passende Unterkünfte und Reiseideen für jede Saison.</p>
    <div className={styles.grid}>{orderedTravelSeasons(date).map(season => <a key={season.slug} className={styles.card} data-current={season === current} href={`/unterkuenfte-a-z?thema=${season.slug}`}>
      <div className={styles.image}><Image src={season.image} alt={season.alt} fill sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 290px" loading="lazy" />{season === current && <span className={styles.badge}>Aktuelle Jahreszeit</span>}</div>
      <div className={styles.copy}><h3>{season.label}</h3><p>{season.intro}</p><span className={styles.link}>Passende Unterkünfte entdecken <span aria-hidden="true">→</span></span></div>
    </a>)}</div>
  </div></section>;
}
