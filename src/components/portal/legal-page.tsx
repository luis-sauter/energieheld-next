import type { ReactNode } from "react";
import Link from "./navigation-link";
import styles from "./legal-page.module.css";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <main id="hauptinhalt" className={`container ${styles.page}`}>
    <Link href="/">← Zur Startseite</Link>
    <h1>{title}</h1>
    <div className={styles.content}>{children}</div>
    <nav aria-label="Rechtliche Informationen" className={styles.links}><Link href="/impressum" prefetch={false}>Impressum</Link><Link href="/datenschutz" prefetch={false}>Datenschutz</Link></nav>
  </main>;
}
