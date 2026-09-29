"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/types/portal";
import { availableTravelFilters, readTravelFilterValues, type PublicTravelTerm, type TravelFilterValues } from "@/lib/reiseportal-filter-options";
import { filterTravelListings, travelFacetCount, travelFilterParams, travelFilterUrl, type TravelFacet } from "@/lib/reiseportal-facets";

type Options = ReturnType<typeof availableTravelFilters>;
type FacetOptions = { slug: string; label: string }[];

export function TravelFinder({ mode, listings, options, values, onChange, error }: {
  mode: "home" | "directory";
  listings: Listing[];
  options: Options;
  values: TravelFilterValues;
  onChange: (values: TravelFilterValues) => void;
  error?: string | null;
}) {
  const router = useRouter();
  const count = filterTravelListings(listings, values).length;
  const update = (key: keyof TravelFilterValues, value: string) => onChange({ ...values, [key]: value });
  const facets: { key: TravelFacet; label: string; all: string; entries: FacetOptions }[] = [
    { key: "destination", label: "Wohin?", all: "Alle Reiseziele", entries: options.destinations },
    { key: "theme", label: "Reiseart", all: "Alle Reisearten", entries: options.themes },
    { key: "audience", label: "Mit wem?", all: "Alle Zielgruppen", entries: options.audiences },
    { key: "accommodation", label: "Unterkunft", all: "Alle Unterkunftstypen", entries: options.accommodations },
    { key: "feature", label: "Besonderheiten", all: "Alle Besonderheiten", entries: options.features },
  ];
  const labels = new Map(facets.flatMap(({ key, label, entries }) => entries.map((entry) =>
    [`${key}:${entry.slug}`, `${label}: ${entry.label}`] as const)));
  const active: { key: keyof TravelFilterValues; label: string }[] = facets.filter(({ key }) => values[key]).map(({ key, label }) => ({
    key, label: labels.get(`${key}:${values[key]}`) ?? `${label}: Nicht verfügbar`,
  }));
  if (values.query) active.push({ key: "query", label: `Suche: ${values.query}` });
  if (values.location) active.push({ key: "location", label: `Ort/PLZ: ${values.location}` });
  const reset = () => onChange(readTravelFilterValues({}));

  return <section className="travel-hero" aria-labelledby="travel-hero-title">
    <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
      <source src="/reiseportal/hero-loop.mp4" type="video/mp4" />
    </video>
    <div className="travel-hero-content container">
      <p className="eyebrow">DAS Reiseportal</p>
      <h1 id="travel-hero-title">Finde deinen passenden Urlaub</h1>
      <p>Sag uns, wie du reisen möchtest – wir zeigen dir passende Orte, Unterkünfte und Erlebnisse.</p>
      <form className="reise-finder" role="search" aria-label="Reisefinder" onSubmit={(event) => {
        event.preventDefault();
        if (count === 0 || error) return;
        if (mode === "home") router.push(travelFilterUrl(values));
        else document.getElementById("unterkunft-ergebnisse")?.scrollIntoView({ behavior: "smooth" });
      }}>
        <div className="reise-finder-grid">
          {facets.filter(({ entries }) => entries.length > 0).map(({ key, label, all, entries }) =>
            <label key={key}>{label}
              <select name={travelFilterParams[key]} value={values[key]} onChange={(event) => update(key, event.target.value)}>
                <option value="">{all}</option>
                {values[key] && !entries.some((entry) => entry.slug === values[key]) &&
                  <option value={values[key]}>Nicht verfügbar (0)</option>}
                {entries.map(({ slug, label: optionLabel }) => {
                  const optionCount = travelFacetCount(listings, values, key, slug);
                  return <option key={slug} value={slug} disabled={optionCount === 0 && values[key] !== slug}>
                    {optionLabel} ({optionCount})
                  </option>;
                })}
              </select>
            </label>)}
          <label>Suchbegriff
            <input name="q" type="search" value={values.query} onChange={(event) => update("query", event.target.value)}
              placeholder="Name oder Reisethema" />
          </label>
          <label>Ort oder Postleitzahl
            <input name="ort" type="search" value={values.location} onChange={(event) => update("location", event.target.value)}
              placeholder="Ort, Region oder PLZ" />
          </label>
          <button className="button button-primary reise-finder-submit" type="submit" disabled={count === 0 || Boolean(error)}>
            {count === 0 ? "Keine passenden Unterkünfte" : `${count} ${count === 1 ? "Unterkunft" : "Unterkünfte"} anzeigen`}
          </button>
        </div>
        <div className="reise-finder-summary" aria-live="polite" aria-atomic="true">
          {error ?? `${count} ${count === 1 ? "passende Unterkunft" : "passende Unterkünfte"}`}
        </div>
        {active.length > 0 && <div className="reise-finder-active" aria-label="Aktive Filter">
          {active.map(({ key, label }) => <button key={key} type="button" className="reise-finder-chip"
            onClick={() => update(key, "")} aria-label={`${label} entfernen`}>{label} <span aria-hidden="true">×</span></button>)}
          <button type="button" className="reise-finder-reset" onClick={reset}>Alle Filter zurücksetzen</button>
        </div>}
      </form>
    </div>
  </section>;
}

export function HomeTravelFinder({ listings, terms, error }: { listings: Listing[]; terms: PublicTravelTerm[]; error?: string | null }) {
  const [values, setValues] = useState<TravelFilterValues>(() => readTravelFilterValues({}));
  const options = useMemo(() => availableTravelFilters(listings, terms), [listings, terms]);
  return <TravelFinder mode="home" listings={listings} options={options}
    values={values} onChange={setValues} error={error} />;
}
