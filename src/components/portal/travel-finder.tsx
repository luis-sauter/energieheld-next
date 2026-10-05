"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import type { Listing } from "@/types/portal";
import { availableTravelFilters, readTravelFilterValues, type PublicTravelTerm, type TravelFilterValues } from "@/lib/reiseportal-filter-options";
import { filterTravelListings, travelFacetCount, travelFilterParams, travelFilterUrl, type TravelFacet } from "@/lib/reiseportal-facets";
import { travelSearchUrl, travelSearchReturnUrl } from "@/lib/travel-search-intent";
import { SEARCH_QUERY_LIMIT } from "@/lib/portal-search-values";
import { Breadcrumbs } from "./breadcrumbs";
import { portalBreadcrumbs } from "@/lib/breadcrumbs";

type Options = ReturnType<typeof availableTravelFilters>;
type FacetOptions = { slug: string; label: string }[];

export function TravelFinder({ mode, listings, options, values, onChange, error, renderFinder, origin = "directory" }: {
  mode: "home" | "directory" | "search";
  origin?: "home" | "directory";
  listings: Listing[];
  options: Options;
  values: TravelFilterValues;
  onChange: (values: TravelFilterValues) => void;
  error?: string | null;
  renderFinder?: (finder: ReactNode) => ReactNode;
}) {
  const portalQuery = values.query.trim();
  const filterValues = { ...values, query: "" };
  const count = filterTravelListings(listings, filterValues).length;
  const update = (key: keyof TravelFilterValues, value: string) => onChange({ ...values, [key]: value });
  const facets: { key: TravelFacet; label: string; all: string; entries: FacetOptions }[] = [
    { key: "destination", label: "Wohin?", all: "Alle Reiseziele", entries: options.destinations },
    { key: "theme", label: "Motto", all: "Alle Mottoreisen", entries: options.themes },
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

  const finder = <form className="reise-finder" role="search" aria-label="Reisefinder" onSubmit={(event) => {
        event.preventDefault();
        if (portalQuery) { window.location.assign(travelSearchUrl(values, mode === "search" ? origin : mode)); return; }
        if (count === 0 || error) return;
        if (mode === "home" || mode === "search") window.location.assign(travelFilterUrl(values));
        else document.getElementById("unterkunft-ergebnisse")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }}>
        <div className="reise-finder-grid">
          {facets.filter(({ entries, key }) => key === "feature" || entries.length > 0).map(({ key, label, all, entries }) =>
            <label key={key}>{label}
              <select name={travelFilterParams[key]} value={values[key]} onChange={(event) => update(key, event.target.value)}>
                <option value="">{all}</option>
                {values[key] && !entries.some((entry) => entry.slug === values[key]) &&
                  <option value={values[key]}>Nicht verfügbar (0)</option>}
                {entries.map(({ slug, label: optionLabel }) => {
                  const optionCount = travelFacetCount(listings, filterValues, key, slug);
                  return <option key={slug} value={slug} disabled={optionCount === 0 && values[key] !== slug}>
                    {optionLabel} ({optionCount})
                  </option>;
                })}
              </select>
            </label>)}
          <label>Suchbegriff
            <input name="q" type="search" value={values.query} onChange={(event) => update("query", event.target.value)}
              maxLength={SEARCH_QUERY_LIMIT} placeholder="Name, Reisethema oder Inhalt" aria-describedby="reise-finder-hint" />
          </label>
          <label>Ort oder Postleitzahl
            <input name="ort" type="search" value={values.location} onChange={(event) => update("location", event.target.value)}
              placeholder="Ort, Region oder PLZ" />
          </label>
          <button className="button button-primary reise-finder-submit" type="submit" disabled={!portalQuery && (count === 0 || Boolean(error))}>
            {portalQuery ? "Im Reiseportal suchen" : count === 0 ? "Keine passenden Unterkünfte" : `${count} ${count === 1 ? "Unterkunft" : "Unterkünfte"} anzeigen`}
          </button>
        </div>
        <div className="reise-finder-summary" aria-live="polite" aria-atomic="true">
          {portalQuery ? "Suche in allen öffentlichen Inhalten" : error ?? `${count} ${count === 1 ? "passende Unterkunft" : "passende Unterkünfte"}`}
        </div>
        <p id="reise-finder-hint">{portalQuery ? "Freitext durchsucht das gesamte Portal. Reisefilter gelten nur bei leerem Suchbegriff und bleiben für Ihre Rückkehr erhalten." : "Mit einem Suchbegriff finden Sie auch Reiseziele, Mottoreisen und weitere Inhalte im gesamten Portal."}</p>
        {active.length > 0 && <div className="reise-finder-active" aria-label="Aktive Filter">
          {active.map(({ key, label }) => <button key={key} type="button" className="reise-finder-chip"
            onClick={() => update(key, "")} aria-label={`${label} entfernen`}>{label} <span aria-hidden="true">×</span></button>)}
          <button type="button" className="reise-finder-reset" onClick={reset}>Alle Filter zurücksetzen</button>
        </div>}
      </form>;

  return <section className="travel-hero" aria-labelledby="travel-hero-title">
    {mode !== "home" ? <Image src="/reiseportal/redesign/unterkuenfte/hero.webp" alt="" fill sizes="100vw" priority className="directory-hero-image" /> : <video autoPlay muted loop playsInline preload="metadata" aria-hidden="true" tabIndex={-1}>
      <source src="/reiseportal/hero-loop.mp4" type="video/mp4" />
    </video>}
    <div className="travel-hero-content container">
      {mode !== "home" && <Breadcrumbs items={portalBreadcrumbs(mode === "search" ? "Suchergebnisse" : "Unterkünfte A–Z", mode === "search" ? "/suche" : "/unterkuenfte-a-z")} />}
      <p className="eyebrow">{mode === "directory" ? "UNTERKÜNFTE A–Z" : "DAS Reiseportal"}</p>
      <h1 id="travel-hero-title">{mode === "directory" ? "Finde passende Unterkünfte" : "Finde deinen passenden Urlaub"}</h1>
      <p>{mode === "directory" ? "Hotels, Pensionen, Ferienwohnungen und mehr – entdecke besondere Orte für deinen nächsten Urlaub." : "Sag uns, wie du reisen möchtest – wir zeigen dir passende Orte, Unterkünfte und Erlebnisse."}</p>
      {renderFinder ? renderFinder(finder) : finder}
    </div>
  </section>;
}

export function HomeTravelFinder({ listings, terms, error, initialValues }: { listings: Listing[]; terms: PublicTravelTerm[]; error?: string | null; initialValues: TravelFilterValues }) {
  const [values, setValues] = useState<TravelFilterValues>(initialValues);
  useEffect(() => {
    const url = travelSearchReturnUrl(values, 'home');
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(window.history.state, '', url);
  }, [values]);
  useEffect(() => {
    const restore = () => setValues(readTravelFilterValues(Object.fromEntries(new URLSearchParams(window.location.search))));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const options = useMemo(() => availableTravelFilters(listings, terms), [listings, terms]);
  return <TravelFinder mode="home" listings={listings} options={options}
    values={values} onChange={setValues} error={error} />;
}

export function SearchTravelFinder({ listings, terms, initialValues, origin, error }: { listings: Listing[]; terms: PublicTravelTerm[]; initialValues: TravelFilterValues; origin: "home" | "directory"; error?: string | null }) {
  const [values, setValues] = useState(initialValues);
  const options = useMemo(() => availableTravelFilters(listings, terms), [listings, terms]);
  return <TravelFinder mode="search" origin={origin} listings={listings} options={options} values={values} onChange={setValues} error={error} />;
}
