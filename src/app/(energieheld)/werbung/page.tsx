import Link from "next/link";
export const metadata = { title: "Werbeplätze – Vorschau" };
export default function AdvertisingPage() {
  return (
    <main id="hauptinhalt" className="container provider-page">
      <p className="eyebrow">Werbung auf Energieheld</p>
      <h1>Sichtbar, wo Projekte beginnen.</h1>
      <p className="lead">
        Ein großer Banner oberhalb der Inhalte und drei eigenständige
        Anzeigenplätze in der rechten Spalte bieten künftig Raum für
        Werbepartner.
      </p>
      <div className="notice">
        <div>
          <h2>Diese Anzeigen sind Demonstrationen.</h2>
          <p>
            Alle Werbekunden und Angebote in der Vorschau sind fiktiv. Es ist
            keine Buchung oder Zahlung möglich. Anzeigen bleiben unabhängig von
            Unternehmensprofilen und vom Qualitätsstempel.
          </p>
        </div>
      </div>
      <Link className="button button-primary" href="/gewerke">
        Zurück zu den Gewerken →
      </Link>
    </main>
  );
}
