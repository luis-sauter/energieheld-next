import Link from "next/link";
import type { Metadata } from "next";
import { energieheld } from "@/config/energieheld";
import { listings, qualityBadges } from "@/data/listings";
import { filterListings } from "@/lib/listings";
import { FilterPanel } from "@/components/portal/search";
import { MobileFilters } from "@/components/portal/mobile-filters";
import { ListingGrid, EmptyState } from "@/components/portal/listings";

export const metadata: Metadata = { title: "Experten finden" };

export default async function ExpertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const filters = {
    query: read("q"),
    category: read("kategorie"),
    location: read("ort"),
    service: read("leistung"),
    sort: read("sort"),
  };
  const results = filterListings(listings, filters);
  const services = [...new Set(listings.flatMap((l) => l.services))].sort(
    (a, b) => a.localeCompare(b, "de"),
  );
  const filtered = Boolean(
    filters.query || filters.category || filters.location || filters.service,
  );
  return (
    <main id="hauptinhalt">
      <section className="page-intro">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
            <Link href="/">Startseite</Link>
            <span>/</span>
            <span>Experten finden</span>
          </nav>
          <p className="eyebrow">Gute Partner. Gute Projekte.</p>
          <h1>
            Die passenden Experten.
            <br />
            <span>Ganz in Ihrer Nähe.</span>
          </h1>
          <p>
            Entdecken Sie Fachbetriebe für Ihr Zuhause – nach Gewerk, Leistung
            und Standort.
          </p>
        </div>
      </section>
      <div className="container directory-layout section">
        <aside>
          <MobileFilters key={JSON.stringify(filters)}>
            <FilterPanel
              categories={energieheld.categories}
              services={services}
              filters={filters}
            />
          </MobileFilters>
        </aside>
        <section aria-labelledby="results-title">
          <div className="results-heading">
            <div>
              <h2 id="results-title">
                {results.length}{" "}
                {results.length === 1 ? "Fachbetrieb" : "Fachbetriebe"}
              </h2>
              <p>
                {filtered
                  ? "Passend zu Ihrer Auswahl"
                  : "Alle Beispielbetriebe in Bayern"}
              </p>
            </div>
            <span className="results-mode">Beispieldaten</span>
          </div>
          {filtered && (
            <div className="active-filters">
              <span>Ihre Auswahl:</span>
              {[
                filters.query,
                energieheld.categories.find((c) => c.id === filters.category)
                  ?.name ?? filters.category,
                filters.location,
                filters.service,
              ]
                .filter(Boolean)
                .map((v, i) => (
                  <span className="badge" key={`${v}-${i}`}>
                    {v}
                  </span>
                ))}
              <Link href="/experten">Zurücksetzen</Link>
            </div>
          )}
          {results.length ? (
            <ListingGrid
              listings={results}
              categories={energieheld.categories}
              badges={qualityBadges}
            />
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
    </main>
  );
}
