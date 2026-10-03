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
import { availableTravelFilters, readTravelFilterValues } from "@/lib/reiseportal-filter-options";
import { loadPublicAds } from "@/lib/public-ads";
import { loadPublicSidebarOrder } from "@/lib/public-sidebar-order";
import styles from "./home.module.css";
import { mottoPresentation } from "@/lib/motto-presentation";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";

const featuredThemes = ["natur-pur", "familienurlaub", "wanderurlaub", "wellnessangebote"];
const quickThemes = ["wellnessangebote", "familienurlaub", "wanderurlaub", "romantik-zu-zweit", "campingurlaub", "radwandern", "urlaub-am-wasser", "golfurlaub"];
const featuredStays = ["bayerischer-wald", "hoeflehner", "pension-sonnenhof", "schafhuber"];

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initialValues = readTravelFilterValues(await searchParams);
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

  return <InlineBannerProvider options={bannerOptions}><main id="hauptinhalt" className={`editorial-home discovery-home ${styles.page}`}>
    <HomeTravelFinder listings={[...directory.preview, ...directory.database]} initialValues={initialValues} terms={terms} error={directory.error} />

    <nav className={`container travel-quicklinks ${styles.quicklinks}`} aria-label="Schnell zu Reisethemen">
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
      <div className={styles.mosaic}>
        {featuredThemes.flatMap((slug, index) => {
          const entry = travelThemes.find((theme) => theme.slug === slug);
          return entry ? <DiscoveryCard key={entry.slug}
            entry={{ ...entry, image: `/reiseportal/redesign/mottoreisen/${entry.slug}.webp`, alt: mottoPresentation[entry.slug].alt }}
            sizes={index === 0 ? "(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 60vw, 740px"
              : "(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 35vw, 380px"}
            basePath="/mottoreisen" /> : [];
        })}
      </div>
    </section>

    <section className={styles.destinations} aria-labelledby="destinations-title"><div className="section container">
      <div className="section-heading"><div><p className="eyebrow">Unterwegs</p><h2 id="destinations-title">Reiseziele</h2></div>
        <Link className="text-link" href="/reiseziele">Alle Reiseziele →</Link></div>
      <div className="discovery-grid">
        {destinations.map((entry) => <DiscoveryCard key={entry.slug}
          entry={{ ...entry, image: `/reiseportal/redesign/reiseziele/${entry.slug}.webp`,
            alt: `See- und Berglandschaft in ${entry.title}` }}
          sizes="(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 45vw, 290px" basePath="/reiseziele" />)}
      </div>
    </div></section>

    <div className={`container premium-space ${styles.premium}`}>
      <CampaignSlot placement="top_banner" ad={ads.find((ad) => ad.placement === "top_banner")} />
    </div>

    <section className={`section container ${styles.stays}`} aria-labelledby="stays-title">
      <div className="section-heading"><div><p className="eyebrow">Aus dem Reiseportal</p><h2 id="stays-title">Ausgewählte Unterkünfte</h2></div>
        <Link className="text-link" href="/unterkuenfte-a-z">Alle Unterkünfte →</Link></div>
      <div className="commercial-columns">
        <div className="accommodation-grid">
          {featured.map((listing) =>
            <AccommodationCard key={listing.id} listing={listing} sizes="(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 45vw, 430px" />)}
        </div>
        <AdvertisingRail slots={sidebarOrder} ads={ads} />
      </div>
    </section>

    <section className={`${styles.provider} container`} aria-labelledby="provider-title">
      <div><p className="eyebrow">Für Gastgeber</p><h2 id="provider-title">Deine Unterkunft auf DAS Reiseportal</h2>
        <p>Stelle deine Unterkunft vor und hinterlege Kontaktinformationen für interessierte Reisende.</p></div>
      <Link className="button button-primary" href="/registrieren">Unterkunft eintragen →</Link>
    </section>
  </main></InlineBannerProvider>;
}
