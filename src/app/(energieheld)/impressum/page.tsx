import { LegalPage } from "@/components/portal/legal-page";
import { portalIdentity } from "@/config/portal-identity";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Impressum", description: "Anbieter- und Kontaktinformationen für DAS-Reiseportal.com. Arbeitsfassung zur rechtlichen Prüfung.", path: "/impressum", noindex: true });

export default function ImprintPage() {
  return <LegalPage title="Impressum">
    <section><h2>Anbieter und Kontakt</h2><address>
      <strong>{portalIdentity.businessName}</strong><br />
      Telefon: <a href={portalIdentity.phoneHref}>{portalIdentity.phone}</a><br />
      E-Mail: <a href={`mailto:${portalIdentity.email}`}>{portalIdentity.email}</a>
    </address></section>
    <section><h2>Noch zu bestätigende Anbieterangaben</h2>
      <p>Die vollständige rechtliche Betreiberbezeichnung und die aktuelle ladungsfähige Anschrift werden derzeit abgeglichen. Die vorliegenden Quellen nennen unterschiedliche Anschriften; deshalb wird hier noch keine Anschrift als verbindlich angegeben.</p>
      <p>Auch die Rechtsform, gegebenenfalls erforderliche Vertretungs- und Registerangaben sowie die aktuelle redaktionelle Verantwortlichkeit sind vor dem Release zu bestätigen.</p>
    </section>
    <section><h2>Umsatzsteuer-Identifikationsnummer</h2>
      <p>Im bisherigen Portal-Impressum ist die Umsatzsteuer-ID <strong>DE813756111</strong> veröffentlicht. Ihre weitere Zuordnung zum aktuellen Betreiber ist noch zu bestätigen.</p>
    </section>
    <section><h2>Datenschutz</h2><p>Informationen zum Stand der Datenschutzprüfung finden Sie in der <a href="/datenschutz">Datenschutzerklärung</a>.</p></section>
  </LegalPage>;
}
