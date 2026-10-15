import { LegalPage } from "@/components/portal/legal-page";
import { portalIdentity } from "@/config/portal-identity";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Datenschutz", description: "Datenschutz bei DAS-Reiseportal.com: technische Verarbeitung und noch offene Freigabepunkte. Arbeitsfassung zur rechtlichen Prüfung.", path: "/datenschutz", noindex: true });

export default function PrivacyPage() {
  return <LegalPage title="Datenschutzerklärung">
    <section><h2>Kontakt und Verantwortlichkeit</h2>
      <p>Für Rückfragen erreichen Sie {portalIdentity.businessName} unter <a href={`mailto:${portalIdentity.email}`}>{portalIdentity.email}</a>. Die vollständige rechtliche Bezeichnung und Anschrift des Verantwortlichen sind noch zu bestätigen; der aktuelle Prüfstand steht im <a href="/impressum">Impressum</a>.</p>
    </section>
    <section><h2>Bereitstellung der Website</h2>
      <p>Der neue Portalauftritt wird über Netlify ausgeliefert. Beim Seitenabruf werden technische Verbindungsdaten, etwa IP-Adresse, angeforderte Seite und Browserangaben, an die Hosting-Infrastruktur übertragen. Umfang und Aufbewahrung der Serverprotokolle sind vor der rechtlichen Freigabe abzugleichen.</p>
    </section>
    <section><h2>Datenbank, Konten und Medien</h2>
      <p>Supabase wird für die Datenbank, die Anmeldung über Supabase Auth und die Speicherung von Dateien über Supabase Storage verwendet. Dazu gehören Unternehmensinformationen, Anfragen, Benutzerkonten und zugeordnete Medien. Für geschützte Dateien verwendet das Portal zeitlich begrenzte Medienlinks.</p>
      <p>Bei der Anmeldung werden Sitzungsinformationen in Cookies gespeichert, damit berechtigte Benutzer auf ihre Verwaltungsfunktionen zugreifen können. Die endgültige Cookie-Liste und die jeweiligen Laufzeiten sind noch zu bestätigen.</p>
      <p>Wenn Sie eine Passwortzurücksetzung anfordern, wird der Wiederherstellungslink über Supabase Auth an Ihre angegebene E-Mail-Adresse versendet.</p>
    </section>
    <section><h2>Kontakt- und Angebotsanfragen</h2>
      <p>Bei einer Kontaktanfrage werden Name, E-Mail-Adresse, gegebenenfalls Telefonnummer und Nachricht zur Bearbeitung im Postfach des ausgewählten Unternehmens gespeichert. Berechtigte Unternehmensbenutzer können diese Anfragen bearbeiten.</p>
      <p>Eine Angebotsanfrage für einen Portalauftritt oder Werbung enthält Unternehmens- und Kontaktdaten sowie die angegebenen Anzeigen-, Zeitraum- und Platzierungswünsche. Optional übermittelte Bilder werden ebenfalls gespeichert. Diese Anfragen werden in der Portalverwaltung bearbeitet.</p>
      <p>Ein automatischer E-Mail-Versand aus diesen Anfrageformularen ist derzeit nicht implementiert. Wenn Sie einen E-Mail-Link öffnen und eine Nachricht versenden, erfolgt dies über Ihr eigenes E-Mail-Programm.</p>
    </section>
    <section><h2>Externe Inhalte und Links</h2>
      <p>Unternehmensprofile können Google Maps einbinden. Beim Laden einer solchen Karte wird eine Verbindung zu Google hergestellt. Unterstützte externe Videos von YouTube oder Vimeo werden nach Betätigung der Wiedergabe eingebunden; dabei erhält der jeweilige Anbieter technische Verbindungsdaten.</p>
      <p>Externe Unternehmenswebsites und Nachrichtenquellen werden über Links geöffnet. Für die dortige Verarbeitung gelten die Informationen des jeweiligen Anbieters. Die rechtlichen Voraussetzungen für die Einbindung externer Inhalte sind vor dem Release gesondert zu prüfen.</p>
    </section>
    <section><h2>Auswertungen und lokale Speicherung</h2>
      <p>Im geprüften Anwendungscode ist kein externer Analyse- oder Marketing-Tracker eingebunden. Ob darüber hinaus plattformseitige Auswertungen aktiviert sind, muss noch bestätigt werden. Die Vorschau der Suchtreffer wird kurzzeitig im Arbeitsspeicher des Browsers zwischengespeichert; sie verwendet dafür keine dauerhafte lokale Speicherung.</p>
    </section>
    <section><h2>Offene Punkte vor der rechtlichen Freigabe</h2>
      <ul>
        <li>Vollständige Identität und Anschrift des Verantwortlichen.</li>
        <li>Rechtsgrundlagen und konkrete Speicher- beziehungsweise Löschfristen je Verarbeitung.</li>
        <li>Vertragspartner, Auftragsverarbeitungsvereinbarungen, tatsächliche Hosting- und Speicherregionen sowie mögliche Drittlandübermittlungen und deren Absicherung.</li>
        <li>Erforderliche Einwilligungen, Cookie-Laufzeiten und die endgültigen Informationen zu Betroffenenrechten und Beschwerdemöglichkeiten.</li>
      </ul>
      <p>Diese technische Arbeitsfassung ersetzt noch keine rechtlich geprüfte Datenschutzerklärung. Eine geplante IONOS-Migration oder künftige Shared Mailbox ist hier nicht als bereits aktiver Dienst beschrieben.</p>
    </section>
  </LegalPage>;
}
