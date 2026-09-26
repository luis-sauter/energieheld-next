import Link from "next/link";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import { AdvertisingRail } from "@/components/advertising/advertising-rail";
import { AccommodationCard } from "@/components/portal/discovery-detail";
import { DiscoveryCard } from "@/components/portal/reise-overview";
import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import { loadReiseportalFeatured } from "@/lib/reiseportal-directory";
import { loadPublicAds } from "@/lib/public-ads";
import { loadPublicSidebarOrder } from "@/lib/public-sidebar-order";

const featuredThemes = ["natur-pur", "familienurlaub", "wanderurlaub", "wellnessangebote"];
const quickThemes = ["wellnessangebote", "familienurlaub", "wanderurlaub", "romantik-zu-zweit", "campingurlaub", "radwandern", "urlaub-am-wasser", "golfurlaub"];
const featuredStays = ["bayerischer-wald", "hoeflehner", "pension-sonnenhof", "schafhuber"];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [ads, sidebarOrder, featured] = await Promise.all([
    loadPublicAds(undefined, "homepage"),
    loadPublicSidebarOrder(),
    loadReiseportalFeatured(featuredStays),
  ]);

  return <main id="hauptinhalt" className="editorial-home discovery-home">
    <section className="travel-hero" aria-labelledby="travel-hero-title">
      <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
        <source src="/reiseportal/hero-loop.mp4" type="video/mp4" />
      </video>
      <div className="travel-hero-content container">
        <p className="eyebrow">DAS Reiseportal</p>
        <h1 id="travel-hero-title">Finde deinen passenden Urlaub</h1>
        <p>Sag uns, wie du reisen möchtest – wir zeigen dir passende Orte, Unterkünfte und Erlebnisse.</p>
        <form className="travel-search" action="/unterkuenfte-a-z" method="get" aria-label="Reise suchen">
          <label>Wohin?
            <select name="ziel" defaultValue="">
              <option value="">Alle Reiseziele</option>
              {destinations.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}
            </select>
          </label>
          <label>Reiseart
            <select name="thema" defaultValue="">
              <option value="">Alle Reisearten</option>
              {travelThemes.map((entry) =>
                <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}
            </select>
          </label>
          <label>Unterkunft
            <input name="q" type="search" placeholder="Name der Unterkunft" />
          </label>
          <label>Ort oder Postleitzahl
            <input name="ort" type="search" placeholder="Ort oder PLZ" />
          </label>
          <label>Sortieren
            <select name="sort" defaultValue="">
              <option value="">Passende Ergebnisse</option>
              <option value="name">Name A–Z</option>
              <option value="city">Ort A–Z</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">Reise finden →</button>
        </form>
      </div>
    </section>

    <nav className="container travel-quicklinks" aria-label="Schnell zu Reisethemen">
      {quickThemes.map((slug) => {
        const entry = travelThemes.find((theme) => theme.slug === slug);
        return entry && <Link key={entry.slug} href={`/mottoreisen/${entry.slug}`}>
          <span className="travel-quicklink-image" style={{ backgroundImage: `url(${entry.image})` }} aria-hidden="true" />
          <span>{entry.title}</span>
        </Link>;
      })}
    </nav>

    <section className="section container" aria-labelledby="inspiration-title">
      <div className="section-heading"><div><p className="eyebrow">Entdecken</p><h2 id="inspiration-title">Inspiration & Themenwelten</h2></div>
        <Link className="text-link" href="/mottoreisen">Alle Mottoreisen →</Link></div>
      <div className="discovery-grid">
        {travelThemes.filter((entry) => featuredThemes.includes(entry.slug)).map((entry) =>
          <DiscoveryCard key={entry.slug} entry={entry} basePath="/mottoreisen" />)}
      </div>
    </section>

    <section className="section container" aria-labelledby="destinations-title">
      <div className="section-heading"><div><p className="eyebrow">Unterwegs</p><h2 id="destinations-title">Reiseziele</h2></div>
        <Link className="text-link" href="/reiseziele">Alle Reiseziele →</Link></div>
      <div className="discovery-grid">
        {destinations.map((entry) => <DiscoveryCard key={entry.slug} entry={entry} basePath="/reiseziele" />)}
      </div>
    </section>

    <section className="section container" aria-labelledby="stays-title">
      <div className="section-heading"><div><p className="eyebrow">Aus dem Reiseportal</p><h2 id="stays-title">Ausgewählte Unterkünfte</h2></div>
        <Link className="text-link" href="/unterkuenfte-a-z">Alle Unterkünfte →</Link></div>
      <div className="commercial-columns">
        <div className="accommodation-grid">
          {featured.map((listing) =>
            <AccommodationCard key={listing.id} listing={listing} />)}
        </div>
        <AdvertisingRail slots={sidebarOrder} ads={ads} />
      </div>
    </section>
    <div className="container premium-space">
      <CampaignSlot placement="top_banner" ad={ads.find((ad) => ad.placement === "top_banner")} />
    </div>
  </main>;
}
