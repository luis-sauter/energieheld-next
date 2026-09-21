import Link from "next/link";
import { Icon } from "@/components/portal/icon";

export const metadata = { title: "Für Unternehmen" };
export default function ProvidersPage() {
  return (
    <main id="hauptinhalt" className="container provider-page">
      <p className="eyebrow">Für Fachbetriebe & Experten</p>
      <h1>
        Ihr Können.
        <br />
        <span>Ihr zukünftiges Profil.</span>
      </h1>
      <p className="lead">
        Energieheld soll Menschen und passende Fachbetriebe zusammenbringen.
        Hier entsteht die Bühne für Ihr Unternehmen.
      </p>
      <div className="notice">
        <Icon name="home" />
        <div>
          <h2>Wir gestalten gerade die Grundlage.</h2>
          <p>
            Registrieren Sie Ihre Firma und erhalten Sie Zugang zu Ihrem
            Firmenbereich. Ihr Profil startet als Entwurf. Im Beispielprofil
            können Sie entdecken, wie ein Unternehmensprofil aussehen wird.
          </p>
        </div>
      </div>
      <p>
        <Link className="button button-primary" href="/registrieren">
          Firma registrieren
        </Link>
      </p>
      <p>
        <Link className="button" href="/login">
          Bereits registriert? Einloggen
        </Link>
      </p>
      <Link
        className="button button-primary"
        href="/experten/mueller-haustechnik"
      >
        Beispielprofil ansehen
        <Icon name="arrow" />
      </Link>
      <section className="detail-section">
        <h2>Profil und Qualitätsstempel bleiben getrennt.</h2>
        <p>
          Das normale Unternehmensprofil stellt Ihren Betrieb vor. Der spätere
          Qualitätsstempel ist ein eigenständiges Angebot mit separatem Antrag
          und Prüfung. Beide Abläufe werden erst in einer späteren Phase
          entwickelt.
        </p>
      </section>
    </main>
  );
}
