"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import type { Listing } from "@/types/portal";
import { availableTravelFilters, readTravelFilterValues, type PublicTravelTerm, type TravelFilterValues } from "@/lib/reiseportal-filter-options";
import { travelFacetCount, travelFilterParams, travelFilterUrl, type TravelFacet } from "@/lib/reiseportal-facets";
import { travelSearchUrl, travelSearchReturnUrl } from "@/lib/travel-search-intent";
import { travelSearchResults, travelSearchAdvertisers, type TravelSearchBanner } from "@/lib/travel-search-banners";
import { SEARCH_QUERY_LIMIT } from "@/lib/portal-search-values";
import { Breadcrumbs } from "./breadcrumbs";
import { portalBreadcrumbs } from "@/lib/breadcrumbs";

import { travelSeason } from "@/lib/travel-seasons";
import { useLiveTravelCount } from './use-live-travel-count';
import type { LiveCountState } from '@/lib/live-travel-count';
import {useAccommodationFacets,type AccommodationFacetState} from './use-accommodation-facets';
import {destinations,travelThemes} from '@/data/reiseportal-discovery';

type Options = ReturnType<typeof availableTravelFilters>;
type CompletedSearch = { values: TravelFilterValues; total?: number; error?: string };

// A URL/form draft is not an executed search. Only submission marks a pending
// request; completedSearch remains the server-authoritative result snapshot.
export function useTravelSearchPending(values: TravelFilterValues, origin: "home" | "directory") {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const signature = travelSearchUrl(values, origin);
  useEffect(() => {
    const restore = () => setSubmitted(null);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  return { searchPending: submitted === signature, onSearchStart: () => setSubmitted(signature) };
}

type FacetOptions = { slug: string; label: string }[];

export function TravelFinder({ mode, listings, options:existingOptions, values, onChange, error, renderFinder, banners = [], origin = "directory", completedSearch, profileTotal, profileLoading, searchPending = false, onSearchStart, liveCount,basicEnabled=false,terms=[],aggregate={loading:false,error:''} }: {
  aggregate?:AccommodationFacetState;
  basicEnabled?:boolean;terms?:PublicTravelTerm[];
  mode: "home" | "directory" | "search";
  origin?: "home" | "directory";
  completedSearch?: CompletedSearch;
  profileTotal?: number;
  profileLoading?: boolean;
  searchPending?: boolean;
  onSearchStart?: () => void;
  liveCount?: LiveCountState & {cancel?:()=>void};
  listings: Listing[];
  banners?: TravelSearchBanner[];
  options: Options;
  values: TravelFilterValues;
  onChange: (values: TravelFilterValues) => void;
  error?: string | null;
  renderFinder?: (finder: ReactNode) => ReactNode;
}) {
  const options=basicEnabled?{...existingOptions,destinations:destinations.map(e=>({slug:e.slug,label:e.title})),themes:travelThemes.map(e=>({slug:e.slug,label:e.title})),audiences:terms.filter(t=>t.dimension==='audience').map(t=>({slug:t.slug,label:t.label})),accommodations:terms.filter(t=>t.dimension==='accommodation').map(t=>({slug:t.slug,label:t.label}))}:existingOptions;
  const portalQuery = values.query.trim();
  const completed = completedSearch && travelSearchUrl(values, origin) === travelSearchUrl(completedSearch.values, origin);
  const filterValues = { ...values, query: "" };
  const matched = travelSearchResults(listings, banners, filterValues);
  const count = (aggregate.value?.total ?? profileTotal ?? matched.listings.length) + matched.advertisers.length;
  const queryTotal = completed && !completedSearch.error && completedSearch.total !== undefined ? completedSearch.total
    : liveCount?.status === 'ready' ? liveCount.total : undefined;
  const queryError = Boolean(completed && completedSearch.error || liveCount?.status === 'error');
  const resultLabel = (total:number) => `${total} ${total === 1 ? 'Ergebnis' : 'Ergebnisse'} anzeigen`;
  const buttonLabel = searchPending ? 'Suche läuft …' : portalQuery
    ? queryTotal !== undefined ? resultLabel(queryTotal) : queryError ? 'Ergebnisse anzeigen' : 'Ergebnisse werden gezählt …'
    : profileLoading || basicEnabled&&!aggregate.value&&aggregate.loading ? 'Ergebnisse werden geladen …' : aggregate.error ? 'Ergebnisse anzeigen' : resultLabel(count);
  const update = (key: keyof TravelFilterValues, value: string) => onChange({ ...values, [key]: value });
  const facets: { key: TravelFacet; label: string; all: string; entries: FacetOptions }[] = [
    { key: "destination", label: "Wohin?", all: "Alle Reiseziele", entries: options.destinations },
    { key: "theme", label: travelSeason(values.theme) ? "Jahreszeit / Motto" : "Motto", all: "Alle Mottoreisen", entries: travelSeason(values.theme) ? [{ slug: values.theme, label: travelSeason(values.theme)!.label }, ...options.themes] : options.themes },
    { key: "audience", label: "Mit wem?", all: "Alle Zielgruppen", entries: options.audiences },
    { key: "accommodation", label: "Unterkunft", all: "Alle Unterkunftstypen", entries: options.accommodations },
  ];
  const labels = new Map(facets.flatMap(({ key, label, entries }) => entries.map((entry) =>
    [`${key}:${entry.slug}`, `${label}: ${entry.label}`] as const)));
  const active: { key: keyof TravelFilterValues; label: string }[] = facets.filter(({ key }) => values[key]).map(({ key, label }) => ({
    key, label: labels.get(`${key}:${values[key]}`) ?? `${label}: Nicht verfügbar`,
  }));
  if (values.query) active.push({ key: "query", label: `${completed || searchPending ? "Suche" : "Eingabe"}: ${values.query}` });
  const reset = () => onChange(readTravelFilterValues({}));

  const finder = <form className="reise-finder" role="search" aria-label="Reisefinder" aria-busy={searchPending || undefined} onSubmit={(event) => {
        event.preventDefault();
        if (searchPending) return;
        if (portalQuery) { liveCount?.cancel?.(); onSearchStart?.(); window.location.assign(travelSearchUrl(values, mode === "search" ? origin : mode)); return; }
        if (count === 0 || error) return;
        if (mode === "home" || mode === "search") window.location.assign(travelFilterUrl(values));
        else document.getElementById("unterkunft-ergebnisse")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }}>
        <div className="reise-finder-grid">
          {facets.some(({entries})=>entries.length>0) && <div className="reise-finder-facets">{facets.filter(({ entries }) => entries.length > 0).map(({ key, label, all, entries }) =>
            <label key={key}>{label}
              <select name={travelFilterParams[key]} value={values[key]} onChange={(event) => update(key, event.target.value)}>
                <option value="">{all}</option>
                {values[key] && !entries.some((entry) => entry.slug === values[key]) &&
                  <option value={values[key]}>Nicht verfügbar (0)</option>}
                {entries.map(({ slug, label: optionLabel }) => {
                  const optionCount = (aggregate.value ? aggregate.value.facets[`${key}:${slug}`]??0 : travelFacetCount(listings, filterValues, key, slug)) + travelSearchAdvertisers(banners, { ...filterValues, [key]: slug }).length;
                  return <option key={slug} value={slug} disabled={optionCount === 0 && values[key] !== slug && (!basicEnabled || Boolean(aggregate.value))}>
                    {optionLabel}{!basicEnabled||aggregate.value?` (${optionCount})`:''}
                  </option>;
                })}
              </select>
            </label>)}</div>}
          <label className="reise-finder-query">Suchbegriff
            <input name="q" type="search" value={values.query} onChange={(event) => update("query", event.target.value)}
              maxLength={SEARCH_QUERY_LIMIT} placeholder="Name, Ort oder Reisethema" aria-describedby="reise-finder-hint" />
          </label>
          <button className="button button-primary reise-finder-submit" type="submit" aria-live="polite" aria-atomic="true"
            aria-busy={searchPending || Boolean(portalQuery && queryTotal === undefined && !queryError) || undefined}
            title={queryError ? 'Die Live-Trefferzahl ist gerade nicht verfügbar. Die Suche bleibt möglich.' : undefined}
            disabled={searchPending || !portalQuery && (profileLoading || count === 0 || Boolean(error))}>
            {buttonLabel}
          </button>
        </div>
        <p id="reise-finder-hint">{portalQuery ? "Freitext durchsucht das gesamte Portal. Gewählte Reisefilter grenzen die Suche auf Unterkünfte ein." : "Mit einem Suchbegriff finden Sie auch Reiseziele, Mottoreisen und weitere Inhalte im gesamten Portal."}</p>
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
      <p className="eyebrow">{mode === "home" ? "DAS-Reiseportal.com · Reiseideen seit 2010" : mode === "directory" ? "UNTERKÜNFTE A–Z" : "DAS-Reiseportal.com"}</p>
      <h1 id="travel-hero-title">{mode === "home" ? "Reisen beginnt mit einer guten Idee" : mode === "directory" ? "Finde passende Unterkünfte" : "Finde deinen passenden Urlaub"}</h1>
      <p>{mode === "home" ? "Ein stiller See, ein Weg in die Berge, ein Ort, den Sie noch nicht kennen. Finden Sie Reiseziele und Gastgeber, die zu Ihren Plänen passen." : mode === "directory" ? "Hotels, Pensionen, Ferienwohnungen und mehr – entdecke besondere Orte für deinen nächsten Urlaub." : "Sag uns, wie du reisen möchtest – wir zeigen dir passende Orte, Unterkünfte und Erlebnisse."}</p>
      {renderFinder ? renderFinder(finder) : finder}
    </div>
  </section>;
}

export function HomeTravelFinder({ listings, terms, error, initialValues, banners,basicEnabled=false }: { basicEnabled?:boolean;listings: Listing[]; terms: PublicTravelTerm[]; error?: string | null; initialValues: TravelFilterValues; banners?: TravelSearchBanner[] }) {
  const [values, setValues] = useState<TravelFilterValues>(initialValues);
  const aggregate=useAccommodationFacets(values,basicEnabled);
  const pending = useTravelSearchPending(values, "home");
  const liveCount = useLiveTravelCount(values);
  useEffect(() => {
    const url = travelSearchReturnUrl(values, 'home');
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(window.history.state, '', url);
  }, [values]);
  useEffect(() => {
    const restore = () => setValues(readTravelFilterValues(Object.fromEntries(new URLSearchParams(window.location.search))));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const options = useMemo(() => availableTravelFilters(listings, terms, banners?.flatMap(b => b.term_keys), banners?.flatMap(b => b.destination_slugs ?? [])), [listings, terms, banners]);
  return <TravelFinder mode="home" basicEnabled={basicEnabled} terms={terms} aggregate={aggregate} {...pending} liveCount={liveCount} banners={banners} listings={listings} options={options}
    values={values} onChange={setValues} error={error} />;
}

export function SearchTravelFinder({ listings, terms, initialValues, origin, error, completedSearch,basicEnabled=false }: { basicEnabled?:boolean;completedSearch?: CompletedSearch; listings: Listing[]; terms: PublicTravelTerm[]; initialValues: TravelFilterValues; origin: "home" | "directory"; error?: string | null }) {
  const [values, setValues] = useState(initialValues);
  const aggregate=useAccommodationFacets(values,basicEnabled);
  const pending = useTravelSearchPending(values, origin);
  const liveCount = useLiveTravelCount(values, completedSearch);
  useEffect(() => {
    const restore = () => setValues(readTravelFilterValues(Object.fromEntries(new URLSearchParams(window.location.search))));
    window.addEventListener('popstate', restore);
    window.addEventListener('pageshow', restore);
    return () => { window.removeEventListener('popstate', restore); window.removeEventListener('pageshow', restore); };
  }, []);
  const options = useMemo(() => availableTravelFilters(listings, terms), [listings, terms]);
  return <TravelFinder mode="search" basicEnabled={basicEnabled} terms={terms} aggregate={aggregate} {...pending} liveCount={liveCount} origin={origin} completedSearch={completedSearch} listings={listings} options={options} values={values} onChange={setValues} error={error} />;
}
