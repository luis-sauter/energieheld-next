"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export function TravelDirectory({ initialValues, database, preview, terms, error, ads, sidebarOrder,
  canReorder, hiddenOrderKeys, saveOrder, saveSidebarOrder }: {
  initialValues: TravelFilterValues;
  database: Listing[];
  preview: Listing[];
  terms: PublicTravelTerm[];
  error: string | null;
  ads: ActiveAd[];
  sidebarOrder: SidebarSlot[];
  canReorder: boolean;
  hiddenOrderKeys: string[];
  saveOrder?: (ids: string[]) => Promise<{ success?: string; error?: string }>;
  saveSidebarOrder?: (slots: SidebarSlot[]) => Promise<{ success?: string; error?: string }>;
}) {
  const [values, setValues] = useState(initialValues);
  const listings = useMemo(() => [...preview, ...database], [preview, database]);
  const options = useMemo(() => availableTravelFilters(database, terms), [database, terms]);
  const results = filterTravelListings(listings, values);
  const databaseResults = filterTravelListings(database, values);
  const previewResults = filterTravelListings(preview, values);
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

  return <main id="hauptinhalt" className="travel-directory-page">
    <TravelFinder mode="directory" listings={listings} options={options} values={values} onChange={setValues} error={error} />
    <div className="container trade-page travel-directory-content">
      <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
        <Link href="/">Startseite</Link><span>›</span><span>Unterkünfte A–Z</span>
      </nav>
      <AdvertisingLayout ads={ads} sidebarOrder={sidebarOrder} editorEnabled={editingAvailable}
        sidebarEditor={editingAvailable && saveSidebarOrder
          ? <SidebarOrderEditor ads={ads} slots={sidebarOrder} saveOrder={saveSidebarOrder} /> : undefined}>
        <section id="unterkunft-ergebnisse" className="travel-results" aria-labelledby="travel-results-title">
          <div className="results-heading travel-results-heading">
            <div>
              <p className="eyebrow">Unterkünfte A–Z</p>
              <h2 id="travel-results-title" aria-live="polite">{results.length} {results.length === 1 ? "Unterkunft" : "Unterkünfte"}</h2>
              <p>Ausgewählte Anbieter aus dem bestehenden Reiseportal · Demo/Testprofil gekennzeichnet</p>
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
              categories={[]} basePath="/unterkuenfte" showVerification={false} premiumFirst />
            {previewResults.length > 0 && <div className="listing-rows">{previewResults.map((listing) =>
              <ListingRow key={listing.id} listing={listing} categories={[]} href={`/unterkuenfte/${listing.slug}`} showVerification={false} />)}</div>}
          </> : !error && results.length > 0 ? <div className="listing-rows">{results.map((listing) =>
            <ListingRow key={listing.id} listing={listing} categories={[]} href={`/unterkuenfte/${listing.slug}`} showVerification={false} />)}</div>
            : !error && <div className="empty-state" role="status">
              <p>Für diese Kombination haben wir aktuell keine passende Unterkunft.</p>
              <button type="button" className="button" onClick={() => setValues(readTravelFilterValues({}))}>Alle Filter zurücksetzen</button>
            </div>}
        </section>
      </AdvertisingLayout>
    </div>
  </main>;
}
