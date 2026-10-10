import Link from "next/link";
import { B2BPage } from "@/components/portal/b2b-page";
import styles from "@/components/portal/b2b.module.css";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({ title: "Werben auf DAS Reiseportal", description: "Werbemöglichkeiten auf DAS Reiseportal: passende Bereiche, Bannerplätze und Zeiträume für Ihre Angebotsanfrage. Anzeigen werden transparent gekennzeichnet.", path: "/werbung" });
export default async function AdvertisingPage() {
  return <B2BPage eyebrow="Für Werbepartner" title="Werben auf DAS Reiseportal" description="Präsentieren Sie Ihr Angebot im passenden Reiseumfeld. Lassen Sie sich persönlich zu passenden Bereichen, Bannerplätzen und Zeiträumen beraten – unverbindlich und ohne Konto.">
    <div className={styles.actions}><Link className="button button-primary" href="/angebot-anfragen">Unverbindlich anfragen</Link></div>
    <section className={styles.section}><h2>Im passenden Kontext sichtbar</h2><div className={styles.grid}>
      <article className={styles.card}><h3>Bereiche und Reiseinteressen</h3><p>Startseite, Unterkünfte A–Z, Reiseziele und Mottoreisen bieten seitenbezogene Bannerplätze. Wählen Sie den Bereich und die passende Unterrubrik.</p></article>
      <article className={styles.card}><h3>Bild und direkte Verbindung</h3><p>Ihr Bannerbild führt über eine Ziel-URL direkt zu Ihrem Angebot. Belegte Suchzuordnungen zu Mit Hund, Mit Kindern oder Zu zweit unterstützen die Auffindbarkeit.</p></article>
      <article className={styles.card}><h3>Zeitraum und Prüfung</h3><p>Fragen Sie Ihren gewünschten Zeitraum an. DAS Reiseportal prüft Inhalt und Verfügbarkeit, bevor eine Anzeige freigegeben wird.</p></article>
    </div></section>
    <section className={styles.section + " " + styles.split}><div className={styles.card}><h2>Bestehende Bannerplätze</h2><p>Ein fester Premium-Platz und reguläre Plätze A–L stehen im bestehenden System zur Verfügung. Die sichtbare Darstellung hängt von der jeweiligen Seite ab.</p><div className={styles.format} aria-label="Schematische Darstellung der Bannerplätze"><div className={styles.premium}>Premium-Banner</div><div className={styles.slots}><span className={styles.slot}>Banner A</span><span className={styles.slot}>Banner B</span><span className={styles.slot}>… L</span></div></div><p className={styles.note}>Schematische Darstellung, keine Kundenanzeige. Klein, Mittel und Groß passen sich responsiv an die verfügbare Fläche an.</p></div><div className={styles.card}><h2>Transparent und getrennt</h2><p>Öffentliche Werbung trägt die Kennzeichnung „Anzeige“. Ein Banner kauft weder redaktionelle Freigabe noch eine bessere Profilplatzierung oder ein Qualitätssiegel.</p><p className={styles.note}>Mit der Angebotsanfrage entsteht keine automatische Buchung oder Zahlung. Konditionen und die bestätigte Laufzeit werden anschließend geklärt.</p><h3>So stellen Sie Ihre Anfrage</h3><ol className={styles.steps}><li>Unternehmen und Kontaktdaten angeben.</li><li>Ihr Anliegen beschreiben – ohne verpflichtende Werbeauswahl.</li><li>Anfrage senden und persönlich beraten lassen.</li></ol></div></section>
  </B2BPage>;
}
