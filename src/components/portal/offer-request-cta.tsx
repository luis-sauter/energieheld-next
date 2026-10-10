import Link from "next/link";
import styles from "./offer-request-cta.module.css";
export function OfferRequestCta(){return <section className={styles.root} aria-label="Für Gastgeber und Reiseanbieter"><div><p className={styles.eyebrow}>Für Gastgeber und Reiseanbieter</p><h2>Ihr Unternehmen auf DAS Reiseportal</h2><p>Wir beraten Sie persönlich zu Ihrer Präsentation und passenden Werbemöglichkeiten.</p></div><Link className="button button-primary" href="/angebot-anfragen">Angebot anfragen</Link></section>;}
