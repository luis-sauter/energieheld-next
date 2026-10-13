import Link from "@/components/portal/navigation-link";
import Image from "next/image";
import { InlineBannerProvider } from "@/components/advertising/inline-banner-editor";
import { loadInlineBannerOptions } from "@/lib/inline-advertising-loader";
import { HomeBannerGroup } from "@/components/advertising/home-banner-group";
import { reiseportalPreview } from "@/data/reiseportal-preview";
import { importedJoomlaMedia } from "@/data/reiseportal-import-media";
import { AccommodationCard } from "@/components/portal/discovery-detail";
import { TravelSeasons } from "@/components/portal/travel-seasons";
import { AutumnShowcase } from "@/components/portal/autumn-showcase";
import { travelThemes } from "@/data/reiseportal-discovery";
import { loadReiseportalDirectory } from "@/lib/reiseportal-directory";
import { loadPublicTravelTerms } from "@/lib/public-travel-taxonomy";
import { ThemeScroller } from "@/components/portal/theme-scroller";
import { HomeTravelFinder } from "@/components/portal/travel-finder";
import { readTravelFilterValues } from "@/lib/reiseportal-filter-options";
import { discoveryAudienceShortcuts } from "@/lib/discovery-shortcuts";
import { loadTravelSearchBanners, mergePublicTravelTerms } from "@/lib/public-travel-search-banners";
import { loadPublicAds } from "@/lib/public-ads";
import styles from "./home.module.css";
import { TravelNews } from "@/components/portal/travel-news";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";
import { pageMetadata, type SearchParameters } from "@/lib/seo";
import { jsonLdGraph, websiteSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/portal/json-ld";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParameters> }) {
  return pageMetadata({ title: "DAS Reiseportal – Reiseideen seit 2010", description: "Reiseideen seit 2010: Entdecken Sie Reiseziele, Mottoreisen und Unterkünfte für Ihre nächste Auszeit. Lernen Sie Gastgeber und ihre Angebote kennen.", path: "/", home: true,
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
  const [ads, directory, terms, bannerOptions, searchBanners] = await Promise.all([
    loadPublicAds(undefined, "homepage"),
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

    <HomeBannerGroup ads={ads} placements={["sidebar_top", "sidebar_middle", "sidebar_bottom"]} label="Anzeigen vor den Themenwelten" />

    <TravelNews />

    <HomeBannerGroup ads={ads} placements={["top_banner"]} label="Premium-Anzeige" />

    <AutumnShowcase listings={directory.database} />
    <TravelSeasons />

    <HomeBannerGroup ads={ads} placements={["sidebar_04", "sidebar_05", "sidebar_06"]} label="Anzeigen nach den Reisezielen" />

    <section className={`section container ${styles.stays}`} aria-labelledby="stays-title">
      <div className="section-heading"><div><p className="eyebrow">Ein guter Ort zum Ankommen</p><h2 id="stays-title">Ausgewählte Unterkünfte</h2></div>
        <Link className="text-link" href="/unterkuenfte-a-z">Alle Unterkünfte →</Link></div>
      <div className={styles.showcase}>
        {featured.map((listing) => <AccommodationCard key={listing.id} listing={listing} cardEditing={Boolean(bannerOptions)}
          sizes="(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 45vw, 25vw" />)}
      </div>
    </section>


    <section className={`${styles.provider} container`} aria-labelledby="provider-title">
      <div><p className="eyebrow">Für Gastgeber</p><h2 id="provider-title">Ihre Unterkunft auf DAS Reiseportal</h2>
        <p>Machen Sie Ihre Unterkunft dort sichtbar, wo neue Reisepläne entstehen. Wir beraten Sie persönlich – unverbindlich und ohne Registrierung.</p></div>
      <Link className="button button-primary" href="/angebot-anfragen">Angebot anfragen →</Link>
    </section>
  </main></InlineBannerProvider>;
}
