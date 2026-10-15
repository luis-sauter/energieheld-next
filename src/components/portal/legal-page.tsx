import type { ReactNode } from "react";
import Link from "./navigation-link";
import styles from "./legal-page.module.css";

export function LegalPage({ title, children, sourceUrl }: { title: string; children: ReactNode; sourceUrl: string }) {
  return <main id="hauptinhalt" className={`container ${styles.page}`}>
    <Link href="/">← Zur Startseite</Link>
    <h1>{title}</h1>
    <aside className={styles.review} aria-label="Quellenübernahme">
      <p>Unveränderte Quellenübernahme: <a href={sourceUrl}>Originaltext von WEIDNER EBM</a>. Eine rechtliche Prüfung für DAS-Reiseportal.com ist damit nicht erfolgt.</p>
    </aside>
    <div className={styles.content}>{children}</div>
    <nav aria-label="Rechtliche Informationen" className={styles.links}><Link href="/impressum" prefetch={false}>Impressum</Link><Link href="/datenschutz" prefetch={false}>Datenschutz</Link></nav>
  </main>;
}
