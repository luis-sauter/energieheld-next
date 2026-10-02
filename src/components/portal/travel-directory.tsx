"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./travel-directory.module.css";
import type { ActiveAd } from "@/lib/ad-values";
import type { SidebarSlot } from "@/lib/sidebar-order";
import type { Listing } from "@/types/portal";
import { availableTravelFilters, readTravelFilterValues, type PublicTravelTerm, type TravelFilterValues } from "@/lib/reiseportal-filter-options";
import { filterTravelListings, travelFilterUrl } from "@/lib/reiseportal-facets";
import { AdvertisingLayout } from "./trades";
import { ListingRow } from "./listing-row";
import { TravelFinder } from "./travel-finder";
import { DirectoryOrderEditor } from "@/components/admin/directory-order-editor";
import { SidebarOrderEditor } from "@/components/admin/sidebar-order-editor";
import { InlineBannerProvider } from "@/components/advertising/inline-banner-editor";
import type { InlineBannerOptions } from "@/lib/inline-ad-context";

export function TravelDirectory({ initialValues, database, preview, terms, error, ads, sidebarOrder,
  canReorder, hiddenOrderKeys, saveOrder, saveSidebarOrder, bannerOptions }: {
  initialValues: TravelFilterValues;
  database: Listing[];
  preview: Listing[];
  terms: PublicTravelTerm[];
  error: string | null;
  ads: ActiveAd[];
  sidebarOrder: SidebarSlot[];
  canReorder: boolean;
  bannerOptions?: InlineBannerOptions;
  hiddenOrderKeys: string[];
  saveOrder?: (ids: string[]) => Promise<{ success?: string; error?: string }>;
  saveSidebarOrder?: (slots: SidebarSlot[]) => Promise<{ success?: string; error?: string }>;
}) {
  const [values, setValues] = useState(initialValues);
  const listings = useMemo(() => [...preview, ...database], [preview, database]);
  const options = useMemo(() => availableTravelFilters(database, terms), [database, terms]);
  const filterValues = { ...values, query: "" };
  const results = filterTravelListings(listings, filterValues);
  const databaseResults = filterTravelListings(database, filterValues);
  const travelLabels = Object.fromEntries(terms.map((term) => [term.term_key, term.label]));
  const premiumResults = results.filter((listing) => listing.directoryPackage === "premium");
  const basicResults = results.filter((listing) => listing.directoryPackage !== "premium");
  const previewResults = filterTravelListings(preview, filterValues);
  const editingAvailable = canReorder && Boolean(saveOrder && saveSidebarOrder) &&
    Object.values(values).every((value) => !value);

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
    <TravelFinder mode="directory" listings={listings} options={options} values={values} onChange={setValues} error={error} />
    <div className="container trade-page travel-directory-content">
      <AdvertisingLayout ads={ads} sidebarOrder={sidebarOrder} editorEnabled={editingAvailable}
        sidebarEditor={editingAvailable && saveSidebarOrder
          ? <SidebarOrderEditor ads={ads} slots={sidebarOrder} saveOrder={saveSidebarOrder} /> : undefined}>
        <section id="unterkunft-ergebnisse" className="travel-results" aria-labelledby="travel-results-title">
          <div className="results-heading travel-results-heading">
            <div>
              <p className="eyebrow">Unterkünfte A–Z</p>
              <h2 id="travel-results-title" aria-live="polite">{results.length} {results.length === 1 ? "Unterkunft" : "Unterkünfte"}</h2>
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
          {error && <div className="empty-state" role="alert"><p>{error}</p></div>}
          {!error && editingAvailable && saveOrder && databaseResults.length > 0 ? <>
            <DirectoryOrderEditor listings={databaseResults} hiddenDemoKeys={hiddenOrderKeys} saveOrder={saveOrder}
              categories={[]} basePath="/unterkuenfte" showVerification={false} premiumFirst travelLabels={travelLabels} />
            {previewResults.length > 0 && <div className="listing-rows">{previewResults.map((listing) =>
              <ListingRow key={listing.id} listing={listing} categories={[]} href={`/unterkuenfte/${listing.slug}`} showVerification={false} travel travelLabels={travelLabels} />)}</div>}
          </> : !error && results.length > 0 ? <>
            {premiumResults.length > 0 && <section className="travel-package-group" aria-labelledby="premium-title">
              <header className="travel-package-heading"><h2 id="premium-title">Premium-Unterkünfte</h2><p>Unterkünfte mit erweitertem Profil im Reiseportal.</p></header>
              <div className="listing-rows">{premiumResults.map((listing) => <ListingRow key={listing.id} listing={listing} categories={[]}
                href={`/unterkuenfte/${listing.slug}`} showVerification={false} travel travelLabels={travelLabels} />)}</div>
            </section>}
            {basicResults.length > 0 && <section className="travel-package-group" aria-labelledby="basic-title">
              <header className="travel-package-heading"><h2 id="basic-title">Weitere Unterkünfte</h2><p>Weitere Gastgeber aus dem Reiseportal – kompakt und übersichtlich.</p></header>
              <div className="listing-rows">{basicResults.map((listing) => <ListingRow key={listing.id} listing={listing} categories={[]}
                href={`/unterkuenfte/${listing.slug}`} showVerification={false} travel travelLabels={travelLabels} />)}</div>
            </section>}
          </> : !error && <div className="empty-state" role="status">
              <p>Für diese Kombination haben wir aktuell keine passende Unterkunft.</p>
              <button type="button" className="button" onClick={() => setValues(readTravelFilterValues({}))}>Alle Filter zurücksetzen</button>
            </div>}
        </section>
      </AdvertisingLayout>
    </div>
  </main></InlineBannerProvider>;
}
