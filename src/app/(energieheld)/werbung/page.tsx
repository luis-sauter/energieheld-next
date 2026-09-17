import Link from "next/link";
export const metadata = { title: "Werbung auf Energieheld" };
export default function AdvertisingPage() {
  return (
    <main id="hauptinhalt" className="container provider-page">
      <p className="eyebrow">Werbung auf Energieheld</p>
      <h1>Sichtbar, wo Projekte beginnen.</h1>
      <p className="lead">
        Ein großer Banner oberhalb der Inhalte und drei eigenständige
        Anzeigenplätze in der rechten Spalte bieten Raum für Werbepartner.
      </p>
      <div className="notice">
        <div>
          <h2>Ihre Werbekampagne planen</h2>
          <p>
            Wählen Sie im Firmenbereich Ihren Werbeplatz, den
            Ausspielungsbereich und den gewünschten Zeitraum. Nach der Prüfung
            bestätigt das Energieheld-Team den verfügbaren Zeitraum. Werbung
            bleibt unabhängig von Profilranking und Qualitätssiegel. Eine
            Zahlung ist in diesem Schritt nicht vorgesehen.
          </p>
        </div>
      </div>
      <Link className="button button-primary" href="/firma/werbung">
        Werbekampagne planen →
      </Link>
    </main>
  );
}
