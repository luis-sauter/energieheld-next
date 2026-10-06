"use client";

import { useEffect, useMemo, useState } from "react";
import { FreshnessStatus } from "@/components/admin/freshness-status";
import { freshnessStates, freshnessMatches, freshnessCounts } from "@/lib/content-freshness";
import type { AdminFreshnessStatuses } from "@/lib/profile-freshness";
import styles from "./travel-directory.module.css";
import type { ActiveAd } from "@/lib/ad-values";
import type { SidebarSlot } from "@/lib/sidebar-order";
import type { Listing } from "@/types/portal";
import { availableTravelFilters, readTravelFilterValues, type PublicTravelTerm, type TravelFilterValues } from "@/lib/reiseportal-filter-options";
import { filterTravelListings, travelFilterUrl } from "@/lib/reiseportal-facets";
import { AdvertisingLayout } from "./trades";
import { ListingRow } from "./listing-row";
import { SearchAdCard } from "@/components/advertising/search-ad-card";
import { travelSearchResults, type TravelSearchBanner } from "@/lib/travel-search-banners";
import { TravelFinder } from "./travel-finder";
import { DirectoryOrderEditor } from "@/components/admin/directory-order-editor";
import { SidebarOrderEditor } from "@/components/admin/sidebar-order-editor";
import { InlineBannerProvider } from "@/components/advertising/inline-banner-editor";
import type { InlineBannerOptions } from "@/lib/inline-ad-context";

export function TravelDirectory({ initialValues, database, preview, terms, error, ads, sidebarOrder,
  canReorder, freshnessStatuses, hiddenOrderKeys, saveOrder, saveSidebarOrder, bannerOptions, banners = [], bannerError }: {
  initialValues: TravelFilterValues;
  database: Listing[];
  preview: Listing[];
  terms: PublicTravelTerm[];
  error: string | null;
  ads: ActiveAd[];
  banners?: TravelSearchBanner[];
  bannerError?: string | null;
  sidebarOrder: SidebarSlot[];
  canReorder: boolean;
  freshnessStatuses?: AdminFreshnessStatuses | null;
  bannerOptions?: InlineBannerOptions;
  hiddenOrderKeys: string[];
  saveOrder?: (ids: string[]) => Promise<{ success?: string; error?: string }>;
  saveSidebarOrder?: (slots: SidebarSlot[]) => Promise<{ success?: string; error?: string }>;
}) {
  const [reviewFilter, setReviewFilter] = useState("");
  const [values, setValues] = useState(initialValues);
  const listings = useMemo(() => [...preview, ...database], [preview, database]);
  const options = useMemo(() => availableTravelFilters(database, terms, banners.flatMap(b => b.term_keys), banners.flatMap(b => b.destination_slugs ?? [])), [database, terms, banners]);
  const filterValues = { ...values, query: "" };
  const matched = travelSearchResults(listings, banners, filterValues);
  const travelResults = matched.listings;
  const summary = freshnessStatuses ? freshnessCounts(travelResults.map(listing => freshnessStatuses[listing.id])) : null;
  const results = travelResults.filter(listing => !freshnessStatuses || freshnessMatches(freshnessStatuses[listing.id], reviewFilter));
  const databaseResults = filterTravelListings(database, filterValues);
  const travelLabels = Object.fromEntries(terms.map((term) => [term.term_key, term.label]));
  const count = results.length + matched.banners.length;
  const previewResults = filterTravelListings(preview, filterValues);
  const editingAvailable = canReorder && Boolean(saveOrder && saveSidebarOrder) &&
    !reviewFilter && Object.values(values).every((value) => !value);

  function renderResults(ordered: Listing[]) {
    const grouped = [...ordered.filter(row => row.directoryPackage === "premium"), ...ordered.filter(row => row.directoryPackage !== "premium")];
    const premium = grouped.filter(row => row.directoryPackage === "premium");
    const basic = grouped.filter(row => row.directoryPackage !== "premium");
    const render = (rows: Listing[]) => <div className="listing-rows">{rows.map(listing =>
      <ListingRow key={listing.id} listing={listing} categories={[]} href={`/unterkuenfte/${listing.slug}`} showVerification={false} travel travelLabels={travelLabels}
        adminStatus={freshnessStatuses?.[listing.id] ? <FreshnessStatus status={freshnessStatuses[listing.id]} /> : undefined} />)}</div>;
    return <>
      {premium.length > 0 && <section className="travel-package-group" aria-labelledby="premium-title">
        <header className="travel-package-heading"><h2 id="premium-title">Premium-Unterkünfte</h2><p>Unterkünfte mit erweitertem Profil im Reiseportal.</p></header>{render(premium)}
      </section>}
      {basic.length > 0 && <section className="travel-package-group" aria-labelledby="basic-title">
        <header className="travel-package-heading"><h2 id="basic-title">Weitere Unterkünfte</h2><p>Weitere Gastgeber aus dem Reiseportal – kompakt und übersichtlich.</p></header>{render(basic)}
      </section>}
    </>;
  }
  const filtered = Boolean(values.destination || values.theme || values.audience || values.accommodation || values.feature || values.location);
  const advertisements = matched.advertisers.length > 0 && <section className="travel-package-group" aria-labelledby="search-ads-title">
    <header className="travel-package-heading"><h2 id="search-ads-title">{filtered ? "Passende Anzeigen" : "Anzeigen"}</h2></header>
    <div className={styles.searchAdGrid}>{matched.advertisers.map(banner => <SearchAdCard key={banner.advertiser_key} banner={banner} />)}</div>
  </section>;

  useEffect(() => {
    const nextUrl = travelFilterUrl(values);
    if (`${window.location.pathname}${window.location.search}` !== nextUrl)
      window.history.replaceState(window.history.state, "", nextUrl);
  }, [values]);
  useEffect(() => {
    const restore = () => setValues(readTravelFilterValues(Object.fromEntries(new URLSearchParams(window.location.search))));
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  return <InlineBannerProvider options={bannerOptions}><main id="hauptinhalt" className={`travel-directory-page ${styles.page}`}>
    <TravelFinder mode="directory" banners={banners} listings={listings} options={options} values={values} onChange={setValues} error={error ?? bannerError} renderFinder={(finder) =>
    <div className="trade-page travel-directory-content">
      <AdvertisingLayout ads={ads} sidebarOrder={sidebarOrder} editorEnabled={editingAvailable} premiumInSidebar showEmptySlots={Boolean(bannerOptions)}
        sidebarEditor={editingAvailable && saveSidebarOrder
          ? <SidebarOrderEditor ads={ads} slots={sidebarOrder} saveOrder={saveSidebarOrder} /> : undefined}>
        {finder}
        <section id="unterkunft-ergebnisse" className="travel-results" aria-labelledby="travel-results-title">
          <div className="results-heading travel-results-heading">
            <div>
              <p className="eyebrow">Unterkünfte A–Z</p>
              <h2 id="travel-results-title" aria-live="polite">{count} {count === 1 ? "Unterkunft" : "Unterkünfte"}</h2>
              <p>Entdecken Sie Gastgeber und besondere Orte für Ihre nächste Reise.</p>
            </div>
            <div className="travel-results-tools">
              <label>Sortieren nach
                <select value={values.sort} onChange={(event) => setValues({ ...values, sort: event.target.value })}>
                  <option value="">Standard</option>
                  <option value="name">Name A–Z</option>
                  <option value="city">Standort A–Z</option>
                </select>
              </label>
              <button type="button" className="reise-finder-reset" onClick={() => setValues(readTravelFilterValues({}))}>
                Filter zurücksetzen
              </button>
            </div>
          </div>
          {freshnessStatuses !== undefined && <div className="admin-freshness-filter">
            {freshnessStatuses ? <>
            <ul className="admin-freshness-summary" aria-label="Prüfübersicht">
              <li><strong>Prüfbedarf {summary!.needsReview}</strong></li>
              {Object.entries(freshnessStates).map(([status, presentation]) => <li key={status}>{presentation.label} {summary!.counts[status as keyof typeof freshnessStates]}</li>)}
            </ul>
            <label>Prüfstatus
              <select value={reviewFilter} onChange={event => setReviewFilter(event.target.value)}>
                <option value="">Alle</option>
                <option value="needs-review">Prüfbedarf</option>
                {Object.entries(freshnessStates).map(([status, presentation]) => <option key={status} value={status}>{presentation.label}</option>)}
              </select>
            </label></> : <p role="alert">Die Prüfstände konnten nicht geladen werden. Bitte laden Sie die Seite erneut.</p>}
          </div>}
          {bannerError && <p role="alert">{bannerError}</p>}
          {error && <div className="empty-state" role="alert"><p>{error}</p></div>}
          {!error && editingAvailable && saveOrder && databaseResults.length > 0 ? <>
            <DirectoryOrderEditor listings={databaseResults} hiddenDemoKeys={hiddenOrderKeys} saveOrder={saveOrder}
              categories={[]} basePath="/unterkuenfte" showVerification={false} premiumFirst travelLabels={travelLabels} freshnessStatuses={freshnessStatuses ?? undefined} renderResults={ordered => renderResults([...ordered, ...previewResults])}
              editingExtras={<div className="listing-rows">{previewResults.map(listing => <ListingRow key={listing.id} listing={listing} categories={[]} href={`/unterkuenfte/${listing.slug}`} showVerification={false} travel travelLabels={travelLabels} />)}</div>} />
          </> : !error && count > 0 ? renderResults(results) : !error && <div className="empty-state" role="status">
              <p>Für diese Kombination haben wir aktuell keine passende Unterkunft.</p>
              <button type="button" className="button" onClick={() => { setValues(readTravelFilterValues({})); setReviewFilter(""); }}>Alle Filter zurücksetzen</button>
            </div>}
          {!error && advertisements}
        </section>
      </AdvertisingLayout>
    </div>} />
  </main></InlineBannerProvider>;
}
