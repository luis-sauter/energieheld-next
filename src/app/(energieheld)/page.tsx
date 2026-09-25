import Image from "next/image";
import Link from "next/link";
import { energieheld } from "@/config/energieheld";
import { HeroSearch } from "@/components/portal/search";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import { AdvertisingRail } from "@/components/advertising/advertising-rail";
import { ListingRow } from "@/components/portal/listing-row";
import { loadPortalCompanies } from "@/lib/portal-companies";
import { loadPublicAds } from "@/lib/public-ads";
import { loadPublicSidebarOrder } from "@/lib/public-sidebar-order";
import { Icon } from "@/components/portal/icon";

const topics = [
  [
    "Photovoltaik",
    "Energie vom eigenen Dach",
    "/gewerke/solar",
    "/images/trades/photovoltaik.jpg",
  ],
  [
    "Heizung",
    "Wärme mit Perspektive",
    "/gewerke/heizung",
    "/images/trades/heizung.jpg",
  ],
  [
    "Dämmung",
    "Ein gutes Gefühl zu Hause",
    "/gewerke/daemmung",
    "/images/trades/daemmung.jpg",
  ],
  [
    "Fachbetriebe",
    "Menschen für Ihr Vorhaben",
    "/experten",
    "/images/trades/gewerke.jpg",
  ],
  ["Bauen & Wohnen", "Raum für neue Ideen", "/gewerke", "/images/house.jpg"],
  [
    "Wellness & Auszeit",
    "Zeit für sich entdecken",
    "/portal-vorschau#hotelprofil",
    "/images/mountains.svg",
  ],
  [
    "Familie & Aktivurlaub",
    "Gemeinsam draußen sein",
    "/portal-vorschau#reiseziele",
    "/images/mountains.svg",
  ],
  [
    "Hotels & Unterkünfte",
    "Besondere Orte zum Bleiben",
    "/portal-vorschau#unterkuenfte",
    "/images/mountains.svg",
  ],
];
const stories = [
  [
    "Bauen & Energie",
    "Ein guter Plan ist der erste Schritt.",
    "Von der Gebäudehülle bis zur Heizung: Entdecken Sie die Themen für Ihr Sanierungsvorhaben.",
    "/gewerke",
    "/images/house.jpg",
  ],
  [
    "Reisen & Entdecken",
    "Eine Auszeit beginnt mit einer Idee.",
    "Berge, Natur und besondere Gastgeber: ein Einblick in unsere Reiseportal-Vorschau.",
    "/portal-vorschau",
    "/images/mountains.svg",
  ],
  [
    "Menschen & Handwerk",
    "Wer passt zu Ihrem Projekt?",
    "Lernen Sie Betriebe und ihre Tätigkeitsbereiche im Verzeichnis kennen.",
    "/experten",
    "/images/trades/gewerke.jpg",
  ],
];
export const dynamic = "force-dynamic";
export default async function Home() {
  const [companies, ads, sidebarOrder] = await Promise.all([
    loadPortalCompanies(),
    loadPublicAds(undefined, "homepage"),
    loadPublicSidebarOrder(),
  ]);
  return (
    <main id="hauptinhalt" className="editorial-home">
      <section className="portal-intro container">
        <div>
          <p className="eyebrow">Energieheld · Zuhause & unterwegs</p>
          <h1>
            Gute Ideen.
            <br />
            Die richtigen Menschen.
          </h1>
          <p>
            Entdecken Sie Fachbetriebe für Ihr Zuhause und Inspiration für die
            nächste Auszeit. Regional verwurzelt. Persönlich verbunden.
          </p>
          <div className="intro-topics">
            <span>Bauen & Energie</span>
            <span>Reisen & Inspiration</span>
          </div>
        </div>
        <div className="intro-picture">
          <Image
            src="/images/house.jpg"
            alt="Modernes Haus mit Garten"
            fill
            sizes="(max-width: 700px) 100vw, 50vw"
            priority
          />
          <span>Lebensräume mit Zukunft</span>
        </div>
        <HeroSearch />
      </section>
      <div className="container premium-space">
        <CampaignSlot placement="top_banner" ad={ads.find((ad) => ad.placement === "top_banner")} />
      </div>
      <section className="section container" id="gewerke">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Entdecken</p>
            <h2>Unsere Themenwelten</h2>
          </div>
          <Link className="text-link" href="/gewerke">
            Alle Gewerke <Icon name="arrow" size={18} />
          </Link>
        </div>
        <div className="topic-worlds">
          {topics.map(([title, text, href, image], i) => (
            <Link className="topic-world" href={href} key={title}>
              <div>
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="(max-width: 600px) 50vw, 25vw"
                />
              </div>
              <span className="eyebrow">
                {i < 5 ? "Energie & Handwerk" : "Reise-Inspiration · Demo"}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="section editorial-band" id="aktuelles">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Das Portal-Magazin</p>
              <h2>Aktuelles & Impulse</h2>
            </div>
            <span className="small muted">Redaktionelle Themenvorschau</span>
          </div>
          <div className="story-grid">
            {stories.map(([category, title, text, href, image]) => (
              <article key={title}>
                <Link href={href}>
                  <div className="story-image">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(max-width: 700px) 100vw, 33vw"
                    />
                  </div>
                  <p className="eyebrow">{category}</p>
                  <h3>{title}</h3>
                </Link>
                <p>{text}</p>
                <Link className="text-link" href={href}>
                  Thema entdecken →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section container" id="empfehlungen">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Menschen & Möglichkeiten</p>
            <h2>Top-Empfehlungen</h2>
            <p>
              Einblicke in unsere Anbieterprofile · gekennzeichnete
              Beispieldaten.
            </p>
          </div>
          <Link className="text-link" href="/experten">
            Zum Verzeichnis →
          </Link>
        </div>
        <div className="commercial-columns">
          <div className="editorial-recommendations listing-rows">
            {companies.error ? <p role="alert">{companies.error}</p> : companies.data?.map((listing) => (
              <ListingRow key={listing.id} listing={listing} categories={energieheld.categories}
                href={`/experten/${listing.slug}`} />
            ))}
          </div>
          <AdvertisingRail slots={sidebarOrder} ads={ads} />
        </div>
      </section>
      <section
        className="section container knowledge-section"
        id="so-funktionierts"
      >
        <div>
          <p className="eyebrow">Wissen & Inspiration</p>
          <h2>
            Gut informiert.
            <br />
            Bewusst entscheiden.
          </h2>
          <p>Orientierung für große Vorhaben und kleine Auszeiten.</p>
        </div>
        <div className="knowledge-links">
          <Link href="/gewerke">
            <span>01 · Zuhause</span>
            <h3>Welche Gewerke gehören zu Ihrem Projekt?</h3>
            <Icon name="arrow" />
          </Link>
          <Link href="/experten">
            <span>02 · Menschen</span>
            <h3>Fachbetriebe und Leistungen kennenlernen</h3>
            <Icon name="arrow" />
          </Link>
          <Link href="/portal-vorschau">
            <span>03 · Unterwegs</span>
            <h3>Neue Lieblingsorte entdecken</h3>
            <Icon name="arrow" />
          </Link>
        </div>
      </section>
      <section className="container cta-wrap">
        <div className="provider-cta">
          <div>
            <p className="eyebrow">Für Unternehmen</p>
            <h2>Sie möchten Ihr Unternehmen präsentieren?</h2>
            <p>Zeigen Sie, wer Sie sind und was Sie besonders macht.</p>
          </div>
          <Link className="button button-primary" href="/fuer-unternehmen">
            Als Experte eintragen <Icon name="arrow" />
          </Link>
        </div>
      </section>
    </main>
  );
}
