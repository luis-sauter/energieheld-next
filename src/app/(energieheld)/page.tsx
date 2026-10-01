import Link from "next/link";
import { InlineBannerProvider } from "@/components/advertising/inline-banner-editor";
import { loadInlineBannerOptions } from "@/lib/inline-advertising-loader";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import { AdvertisingRail } from "@/components/advertising/advertising-rail";
import { AccommodationCard } from "@/components/portal/discovery-detail";
import { DiscoveryCard } from "@/components/portal/reise-overview";
import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import { loadReiseportalDirectory } from "@/lib/reiseportal-directory";
import { loadPublicTravelTerms } from "@/lib/public-travel-taxonomy";
import { HomeTravelFinder } from "@/components/portal/travel-finder";
import { availableTravelFilters } from "@/lib/reiseportal-filter-options";
import { loadPublicAds } from "@/lib/public-ads";
import { loadPublicSidebarOrder } from "@/lib/public-sidebar-order";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";

const featuredThemes = ["natur-pur", "familienurlaub", "wanderurlaub", "wellnessangebote"];
const quickThemes = ["wellnessangebote", "familienurlaub", "wanderurlaub", "romantik-zu-zweit", "campingurlaub", "radwandern", "urlaub-am-wasser", "golfurlaub"];
const featuredStays = ["bayerischer-wald", "hoeflehner", "pension-sonnenhof", "schafhuber"];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [ads, sidebarOrder, directory, terms, bannerOptions] = await Promise.all([
    loadPublicAds(undefined, "homepage"),
    loadPublicSidebarOrder(),
    loadReiseportalDirectory(),
    loadPublicTravelTerms(),
    loadInlineBannerOptions("/"),
  ]);
  const bySlug = new Map(directory.database.map((listing) => [listing.slug, listing]));
  const featured = featuredStays.flatMap((slug) => {
    const listing = bySlug.get(slug);
    return listing ? [listing] : [];
  });
  const searchableThemes = new Set(availableTravelFilters(directory.database, terms).themes.map((entry) => entry.slug));

  return <InlineBannerProvider options={bannerOptions}><main id="hauptinhalt" className="editorial-home discovery-home">
    <HomeTravelFinder listings={[...directory.preview, ...directory.database]} terms={terms} error={directory.error} />

    <nav className="container travel-quicklinks" aria-label="Schnell zu Reisethemen">
      {quickThemes.map((slug) => {
        const entry = travelThemes.find((theme) => theme.slug === slug);
        return entry && searchableThemes.has(entry.slug) && <a key={entry.slug} href={`/unterkuenfte-a-z?thema=${entry.slug}`}>
          <span className="travel-quicklink-icon" aria-hidden="true"><TravelThemeIcon slug={entry.slug} /></span>
          <span>{entry.title}</span>
        </a>;
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

    <div className="container premium-space">
      <CampaignSlot placement="top_banner" ad={ads.find((ad) => ad.placement === "top_banner")} />
    </div>

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

  </main></InlineBannerProvider>;
}
