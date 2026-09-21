import Image from "next/image";
import Link from "next/link";
import { trades } from "@/config/trades";
import { AdvertisingLayout, TradeTiles } from "@/components/portal/trades";

export const metadata = { title: "Gewerke – Bauen und Sanieren" };
export default function TradesPage() {
  return (
    <main id="hauptinhalt" className="container trade-page">
      <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
        <Link href="/">Startseite</Link>
        <span>›</span>
        <span>Gewerke</span>
      </nav>
      <section className="reference-intro">
        <div>
          <p className="eyebrow">Bauen · Modernisieren · Energie sparen</p>
          <h1>Gewerke</h1>
          <p>
            Vom Dach bis zum Boden: Finden Sie das passende Gewerk für Ihr
            Vorhaben. Entdecken Sie Fachbereiche rund um Dämmung, Fenster,
            Heizung, Photovoltaik und Ihr Zuhause.
          </p>
          <p>
            Jedes Projekt braucht die richtigen Menschen. Hier finden Sie die
            Themen im Überblick – und gelangen direkt zu den passenden
            Beispielbetrieben.
          </p>
          <Link className="button button-primary" href="/experten">
            Alle Experten anzeigen →
          </Link>
        </div>
        <div className="reference-image">
          <Image
            src="/images/trades/gewerke.jpg"
            alt="Werkzeuge als Symbol für die verschiedenen Gewerke"
            fill
            sizes="(max-width: 700px) 100vw, 55vw"
            priority
          />
        </div>
      </section>
      <AdvertisingLayout>
        <div className="section-heading">
          <div>
            <h2>Alle Gewerke im Überblick</h2>
            <p>Wählen Sie den Fachbereich für Ihr Projekt.</p>
          </div>
          <span className="results-mode">14 Gewerke</span>
        </div>
        <TradeTiles items={trades} />
      </AdvertisingLayout>
    </main>
  );
}
