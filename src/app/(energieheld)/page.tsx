import Image from "next/image";
import Link from "next/link";
import { energieheld } from "@/config/energieheld";
import { listings, qualityBadges } from "@/data/listings";
import { HeroSearch } from "@/components/portal/search";
import { ListingGrid } from "@/components/portal/listings";
import { TradeTiles } from "@/components/portal/trades";
import { trades } from "@/config/trades";
import { AdSlot } from "@/components/portal/ads";
import { energyAds } from "@/data/energy-ads";
import { Icon } from "@/components/portal/icon";

export default function Home() {
  return (
    <main id="hauptinhalt">
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="orange-line" /> Ihr Zuhause. Ihre Zukunft.
            </p>
            <h1>Sanieren mit Grips in München und Bayern.</h1>
            <p className="hero-description">
              Sie planen eine energetische Sanierung oder einen Neubau?
              Entdecken Sie Gewerke, lernen Sie Fachbetriebe kennen und finden
              Sie die passenden Menschen für Ihr Vorhaben.
            </p>
            <div className="hero-note">
              <Icon name="pin" size={18} />
              <span>In Ihrer Region. Für Ihr Projekt.</span>
            </div>
          </div>
          <div className="hero-visual">
            <Image
              src="/images/house.jpg"
              alt="Modernes Wohnhaus mit Garten als Inspiration für ein Sanierungsprojekt"
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
              priority
            />
            <div className="hero-image-label">
              <Icon name="home" />
              <div>
                <strong>Zukunft beginnt zu Hause.</strong>
                <span>Gemeinsam den nächsten Schritt gehen.</span>
              </div>
            </div>
          </div>
          <HeroSearch />
        </div>
      </section>
      <div className="container homepage-ad">
        <AdSlot placement="trade_top" ad={energyAds[0]} />
      </div>
      <div className="trust-row container">
        <span>
          <Icon name="home" /> Bauen & Sanieren
        </span>
        <span>
          <Icon name="sun" /> Energie neu denken
        </span>
        <span>
          <Icon name="pin" /> Fachbetriebe aus Bayern
        </span>
        <span className="trust-signature">Sanieren mit Grips.</span>
      </div>
      <section className="section container" id="gewerke">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Hier beginnt Ihr Projekt</p>
            <h2>Gewerke für Ihr Vorhaben</h2>
            <p>Entdecken Sie die passenden Fachbetriebe für Ihr Vorhaben.</p>
          </div>
          <Link className="text-link" href="/gewerke">
            Alle 14 Gewerke ansehen <Icon name="arrow" size={19} />
          </Link>
        </div>
        <TradeTiles items={trades.slice(0, 8)} />
      </section>
      <section className="section soft-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Menschen, die anpacken</p>
              <h2>Gute Adressen für Ihre Ideen.</h2>
              <p>Ein erster Einblick in die zukünftigen Unternehmensprofile.</p>
            </div>
            <Link className="text-link" href="/experten">
              Alle {listings.length} Beispielbetriebe{" "}
              <Icon name="arrow" size={19} />
            </Link>
          </div>
          <ListingGrid
            listings={listings.slice(0, 3)}
            categories={energieheld.categories}
            badges={qualityBadges}
          />
        </div>
      </section>
      <section className="section container how-section" id="so-funktionierts">
        <div>
          <p className="eyebrow">Einfach zum passenden Fachbetrieb</p>
          <h2>
            Ihr Vorhaben.
            <br />
            Ein klarer nächster Schritt.
          </h2>
          <p>
            Ein Ort für Ihre Suche. Damit aus einer Idee ein konkretes Projekt
            werden kann.
          </p>
          <Link className="text-link" href="/experten">
            Jetzt umsehen <Icon name="arrow" size={19} />
          </Link>
        </div>
        <ol className="steps">
          <li>
            <span>01</span>
            <div>
              <h3>Vorhaben auswählen</h3>
              <p>
                Was steht an? Finden Sie Ihr Gewerk und grenzen Sie Ihre Region
                ein.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Fachbetriebe kennenlernen</h3>
              <p>
                Vergleichen Sie Profile, Leistungen und Schwerpunkte in Ruhe.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Gemeinsam weiterdenken</h3>
              <p>
                Später nehmen Sie direkt Kontakt auf. In dieser Vorschau
                erkunden Sie zunächst Beispielprofile.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="container cta-wrap">
        <div className="provider-cta">
          <div>
            <p className="eyebrow">Für die Macher von morgen</p>
            <h2>
              Gutes Handwerk verdient
              <br />
              eine gute Bühne.
            </h2>
            <p>Zeigen Sie künftig, was Ihren Betrieb besonders macht.</p>
          </div>
          <Link className="button button-primary" href={energieheld.cta.href}>
            {energieheld.cta.label}
            <Icon name="arrow" />
          </Link>
        </div>
      </section>
    </main>
  );
}
