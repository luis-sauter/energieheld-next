import Link from "next/link";
import { B2BPage } from "@/components/portal/b2b-page";
import styles from "@/components/portal/b2b.module.css";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata({ title: "Für Gastgeber und Reiseanbieter", description: "Ihre Unterkunft auf DAS Reiseportal: Firmenkonto anlegen, Profil pflegen und zur Freigabe einreichen. Informationen für Gastgeber und Reiseanbieter.", path: "/fuer-unternehmen" });
export default function ProvidersPage() {
  return <B2BPage eyebrow="Für Gastgeber und Reiseanbieter" title="Ihre Unterkunft auf DAS Reiseportal" description="Zeigen Sie Reisenden, was Ihre Unterkunft besonders macht – mit einem eigenen Profil, passenden Reiseinteressen und direkten Kontaktmöglichkeiten.">
    <div className={styles.actions}><Link className="button button-primary" href="/registrieren">Unterkunft eintragen</Link><Link className="button" href="/login">Bereits registriert? Einloggen</Link></div>
    <section className={styles.section}><h2>Ein klarer Auftritt für Ihr Angebot</h2><p>Für Hotels, Pensionen, Ferienwohnungen, Campingplätze und weitere passende Reiseanbieter.</p><div className={styles.grid}>
      <article className={styles.card}><h3>Ihre Unterkunft vorstellen</h3><p>Beschreibung, Bilder und Galerie vermitteln einen Eindruck. Hinterlegen Sie Kontakt- und Standortdaten und halten Sie diese aktuell.</p></article>
      <article className={styles.card}><h3>Passend entdeckt werden</h3><p>Reiseziele, Mottoreisen und belegte Zielgruppen wie Mit Hund, Mit Kindern oder Zu zweit helfen bei der Suche nach passenden Angeboten.</p></article>
      <article className={styles.card}><h3>Direkt in Kontakt kommen</h3><p>Reisende können Ihre Kontaktmöglichkeiten nutzen oder eine Anfrage über das Portal senden. Im Firmenbereich behalten Sie eingegangene Anfragen im Blick.</p></article>
    </div></section>
    <section className={styles.section + " " + styles.split}><div className={styles.card}><h2>In vier Schritten zum öffentlichen Profil</h2><ol className={styles.steps}><li>Firmenkonto erstellen und E-Mail bestätigen.</li><li>Profil mit Angaben und Bildern vervollständigen.</li><li>Zur Prüfung einreichen. DAS Reiseportal entscheidet über die Freigabe.</li><li>Nach Freigabe öffentlich im Portal gefunden werden.</li></ol></div><div className={styles.card}><h2>Basic und Premium</h2><p>Basic zeigt die wesentlichen Profil- und Kontaktangaben in einer kompakten Übersicht. Premium wird mit Bildern und einer ausführlicheren Karte vor Basic angezeigt.</p><p className={styles.note}>Die Paketzuordnung wird vom Portal verwaltet. Konditionen und mögliche Zusatzleistungen werden individuell geklärt; hier findet kein Paketkauf statt.</p><h3>Vollständig und aktuell</h3><p>Die Redaktion prüft eingereichte Inhalte. Bitte pflegen Sie korrekte Angaben und nur Bilder, für die Sie die nötigen Rechte besitzen.</p></div></section>
    <section className={styles.section + " " + styles.card + " " + styles.promo}><h2>Mehr Sichtbarkeit gewünscht?</h2><p>Banner sind ein optionales Zusatzangebot. Werbung wird als Anzeige gekennzeichnet und bleibt von redaktioneller Freigabe und Profilranking getrennt.</p><div className={styles.actions}><Link className="button" href="/werbung">Werbemöglichkeiten kennenlernen →</Link></div></section>
  </B2BPage>;
}
