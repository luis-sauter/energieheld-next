import Link from "@/components/portal/navigation-link";
import { InlineBannerProvider } from "@/components/advertising/inline-banner-editor";
import { loadInlineBannerOptions } from "@/lib/inline-advertising-loader";
import { HomeBannerGroup } from "@/components/advertising/home-banner-group";
import { randomUUID } from "node:crypto";
import { selectHomeStays } from "@/lib/home-stays";
import { MottoRow } from "@/components/portal/motto-row";
import { AccommodationCard } from "@/components/portal/discovery-detail";
import { AutumnShowcase } from "@/components/portal/autumn-showcase";
import { EuropeMap } from "@/components/portal/europe-map";
import { companyMapLocations } from "@/lib/company-map-locations";
import { loadReiseportalDirectory } from "@/lib/reiseportal-directory";
import { loadPublicTravelTerms } from "@/lib/public-travel-taxonomy";
import { TravelQuicklinks } from "@/components/portal/travel-quicklinks";
import { HomeTravelFinder } from "@/components/portal/travel-finder";
import { readTravelFilterValues } from "@/lib/reiseportal-filter-options";
import { loadTravelSearchBanners, mergePublicTravelTerms } from "@/lib/public-travel-search-banners";
import { loadPublicAds } from "@/lib/public-ads";
import styles from "./home.module.css";
import { TravelNews } from "@/components/portal/travel-news";
import { pageMetadata, type SearchParameters } from "@/lib/seo";
import { jsonLdGraph, websiteSchema } from "@/lib/seo-schema";
import { JsonLd } from "@/components/portal/json-ld";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParameters> }) {
  return pageMetadata({ title: "DAS-Reiseportal.com – Reiseideen seit 2010", description: "Reiseideen seit 2010: Entdecken Sie Reiseziele, Mottoreisen und Unterkünfte für Ihre nächste Auszeit. Lernen Sie Gastgeber und ihre Angebote kennen.", path: "/", home: true,
    noindex: Object.values(await searchParams).some(Boolean) });
}

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initialValues = readTravelFilterValues(await searchParams);
  const [ads, directory, terms, bannerOptions, searchBanners] = await Promise.all([
    loadPublicAds(undefined, "homepage"),
    loadReiseportalDirectory(),
    loadPublicTravelTerms(),
    loadInlineBannerOptions("/"), loadTravelSearchBanners(),
  ]);
  const featured = selectHomeStays(directory.database, randomUUID());

  return <InlineBannerProvider options={bannerOptions}><main id="hauptinhalt" className={`editorial-home discovery-home ${styles.page}`}>
    <JsonLd data={jsonLdGraph(websiteSchema())} />
    <HomeTravelFinder banners={searchBanners.banners} listings={[...directory.preview, ...directory.database]} initialValues={initialValues} terms={mergePublicTravelTerms(terms,searchBanners.terms)} error={directory.error ?? searchBanners.error} />

    <TravelQuicklinks className={`container ${styles.quicklinks}`} />

    <HomeBannerGroup ads={ads} placements={["sidebar_top", "sidebar_middle", "sidebar_bottom"]} label="Anzeigen vor den Themenwelten" />

    <TravelNews />

    <HomeBannerGroup ads={ads} placements={["top_banner"]} label="Premium-Anzeige" />

    <AutumnShowcase listings={directory.database} />

    <EuropeMap locations={companyMapLocations(directory.database, searchBanners.banners)} />

    <HomeBannerGroup ads={ads} placements={["sidebar_04", "sidebar_05", "sidebar_06"]} label="Anzeigen nach den Reisezielen" />

    <section className={`section container ${styles.stays}`} aria-labelledby="stays-title">
      <div className="section-heading"><div><p className="eyebrow">Ein guter Ort zum Ankommen</p><h2 id="stays-title">Ausgewählte Unterkünfte</h2></div>
        <Link className="text-link" href="/unterkuenfte-a-z">Alle Unterkünfte →</Link></div>
      <MottoRow label="Ausgewählte Unterkünfte" speed={18}>
        {featured.map((listing) => <AccommodationCard key={listing.id} listing={listing} motto cardEditing={Boolean(bannerOptions)}
          sizes="(max-width: 600px) 86vw, (max-width: 900px) 45vw, 360px" />)}
      </MottoRow>
    </section>


    <section className={`${styles.provider} container`} aria-labelledby="provider-title">
      <div><p className="eyebrow">Für Gastgeber</p><h2 id="provider-title">Ihre Unterkunft auf DAS-Reiseportal.com</h2>
        <p>Machen Sie Ihre Unterkunft dort sichtbar, wo neue Reisepläne entstehen. Wir beraten Sie persönlich – unverbindlich und ohne Registrierung.</p></div>
      <Link className="button button-primary" href="/angebot-anfragen">Angebot anfragen →</Link>
    </section>
  </main></InlineBannerProvider>;
}
