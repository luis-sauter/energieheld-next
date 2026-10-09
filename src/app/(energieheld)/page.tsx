import Link from "next/link";
import Image from "next/image";
import { InlineBannerProvider } from "@/components/advertising/inline-banner-editor";
import { loadInlineBannerOptions } from "@/lib/inline-advertising-loader";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import { AdvertisingRail } from "@/components/advertising/advertising-rail";
import { reiseportalPreview } from "@/data/reiseportal-preview";
import { importedJoomlaMedia } from "@/data/reiseportal-import-media";
import { AccommodationCard } from "@/components/portal/discovery-detail";
import { DiscoveryCard } from "@/components/portal/reise-overview";
import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import { loadReiseportalDirectory } from "@/lib/reiseportal-directory";
import { loadPublicTravelTerms } from "@/lib/public-travel-taxonomy";
import { ThemeScroller } from "@/components/portal/theme-scroller";
import { HomeTravelFinder } from "@/components/portal/travel-finder";
import { readTravelFilterValues } from "@/lib/reiseportal-filter-options";
import { discoveryAudienceShortcuts } from "@/lib/discovery-shortcuts";
import { loadTravelSearchBanners, mergePublicTravelTerms } from "@/lib/public-travel-search-banners";
import { loadPublicAds } from "@/lib/public-ads";
import { loadPublicSidebarOrder } from "@/lib/public-sidebar-order";
import styles from "./home.module.css";
import { mottoPresentation } from "@/lib/motto-presentation";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";
import { pageMetadata, type SearchParameters } from "@/lib/seo";
import { siteSeo } from "@/lib/site-seo";
import { jsonLdGraph, websiteSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/portal/json-ld";

const site = siteSeo();
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParameters> }) {
  return pageMetadata({ title: site.defaultTitle, description: site.defaultDescription, path: "/", home: true,
    noindex: Object.values(await searchParams).some(Boolean) });
}

// Editorial selection, not package ranking. These provider-matched originals
// were visually checked for this showcase; profile galleries remain unchanged.
const featuredStays = [
  { slug: "golfhotel-andreus", image: importedJoomlaMedia["golfhotel-andreus"].images[3] },
  ...["bayerischer-wald", "hoeflehner", "schafhuber"].map((slug) => ({
    slug, image: reiseportalPreview.find((listing) => listing.slug === slug)?.images[slug === "schafhuber" ? 3 : 0],
  })),
];

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initialValues = readTravelFilterValues(await searchParams);
  const [ads, sidebarOrder, directory, terms, bannerOptions, searchBanners] = await Promise.all([
    loadPublicAds(undefined, "homepage"),
    loadPublicSidebarOrder(),
    loadReiseportalDirectory(),
    loadPublicTravelTerms(),
    loadInlineBannerOptions("/"), loadTravelSearchBanners(),
  ]);
  const bySlug = new Map(directory.database.map((listing) => [listing.slug, listing]));
  const featured = featuredStays.flatMap(({ slug, image }) => {
    const listing = bySlug.get(slug);
    return listing && image && !listing.isDemo && !listing.isPreview ? [{ ...listing, images: [image] }] : [];
  });
  const discoveryAudiences = discoveryAudienceShortcuts();

  return <InlineBannerProvider options={bannerOptions}><main id="hauptinhalt" className={`editorial-home discovery-home ${styles.page}`}>
    <JsonLd data={jsonLdGraph(websiteSchema())} />
    <HomeTravelFinder banners={searchBanners.banners} listings={[...directory.preview, ...directory.database]} initialValues={initialValues} terms={mergePublicTravelTerms(terms,searchBanners.terms)} error={directory.error ?? searchBanners.error} />

    <nav className={`container ${styles.quicklinks}`} aria-label="Schnell zu Mottoreisen und Mit wem?" data-travel-quicklinks>
      <ThemeScroller count={travelThemes.length + discoveryAudiences.length} label="Mottoreisen" compact>
        {discoveryAudiences.map((entry) => <a key={`audience:${entry.slug}`} href={`/unterkuenfte-a-z?zielgruppe=${encodeURIComponent(entry.slug)}`} data-theme-image>
          <Image src={entry.image} alt="" fill sizes="(max-width: 640px) 45vw, (max-width: 1100px) 23vw, 200px" loading="lazy" />
          <span className="travel-quicklink-icon" aria-hidden="true"><TravelThemeIcon slug={entry.icon} /></span><span>{entry.label}</span>
        </a>)}
        {travelThemes.map((entry) => <a key={entry.slug} href={`/unterkuenfte-a-z?thema=${entry.slug}`} data-theme-image>
          <Image src={`/reiseportal/redesign/mottoreisen/${entry.slug}.webp`} alt="" fill sizes="(max-width: 640px) 45vw, (max-width: 1100px) 23vw, 200px" loading="lazy" />
          <span className="travel-quicklink-icon" aria-hidden="true"><TravelThemeIcon slug={entry.slug} /></span>
          <span>{entry.title}</span>
        </a>)}
      </ThemeScroller>
    </nav>

    <section className="section container" aria-labelledby="inspiration-title">
      <ThemeScroller count={travelThemes.length} label="Inspiration & Themenwelten"
        heading={<div><p className="eyebrow">Entdecken</p><h2 id="inspiration-title">Inspiration & Themenwelten</h2></div>}
        moreLink={<Link className="text-link" href="/mottoreisen">Alle Mottoreisen →</Link>}>
        {travelThemes.map((entry) => <DiscoveryCard key={entry.slug}
          entry={{ ...entry, image: `/reiseportal/redesign/mottoreisen/${entry.slug}.webp`, alt: mottoPresentation[entry.slug].alt }}
          sizes="(max-width: 640px) calc(100vw - 48px), (max-width: 1100px) 45vw, 400px"
          basePath="/mottoreisen" />)}
      </ThemeScroller>
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

    <section className={`section container ${styles.stays}`} aria-labelledby="stays-title">
      <div className="section-heading"><div><p className="eyebrow">Aus dem Reiseportal</p><h2 id="stays-title">Ausgewählte Unterkünfte</h2></div>
        <Link className="text-link" href="/unterkuenfte-a-z">Alle Unterkünfte →</Link></div>
      <div className={styles.showcase}>
        {featured[0] && <div className={styles.featuredStay}>
          <AccommodationCard listing={featured[0]} sizes="(max-width: 1100px) calc(100vw - 48px), 620px" />
        </div>}
        <div className={styles.recommendations}>
          {featured.slice(1).map((listing) => <AccommodationCard key={listing.id} listing={listing}
            sizes="(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 45vw, 300px" />)}
        </div>
      </div>
    </section>

    <section className={styles.partners} aria-labelledby="partners-title"><div className="section container">
      <div className="section-heading"><div><p className="eyebrow">Anzeigen</p><h2 id="partners-title">Partner & Gastgeber</h2></div></div>
      <div className={styles.premium}>
        <CampaignSlot placement="top_banner" ad={ads.find((ad) => ad.placement === "top_banner")} />
      </div>
      <AdvertisingRail slots={sidebarOrder} ads={ads} />
    </div></section>

    <section className={`${styles.provider} container`} aria-labelledby="provider-title">
      <div><p className="eyebrow">Für Gastgeber</p><h2 id="provider-title">Deine Unterkunft auf DAS Reiseportal</h2>
        <p>Stelle deine Unterkunft vor und hinterlege Kontaktinformationen für interessierte Reisende.</p></div>
      <Link className="button button-primary" href="/registrieren">Unterkunft eintragen →</Link>
    </section>
  </main></InlineBannerProvider>;
}
