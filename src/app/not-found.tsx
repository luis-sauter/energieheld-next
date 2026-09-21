import Link from "next/link";
export default function NotFound() {
  return (
    <main id="hauptinhalt" className="empty-state not-found">
      <p className="eyebrow">404 · Seite nicht gefunden</p>
      <h1>Hier geht es gerade nicht weiter.</h1>
      <p>Dieses Profil oder diese Seite gibt es in der Vorschau nicht.</p>
      <Link className="button button-primary" href="/experten">
        Zur Expertenübersicht
      </Link>
    </main>
  );
}
