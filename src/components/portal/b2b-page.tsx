import type { ReactNode } from "react";
import styles from "./b2b.module.css";

export function B2BPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main id="hauptinhalt" className={styles.page}>
    <div className="container">
      <header className={styles.hero}><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>
      {children}
    </div>
  </main>;
}
