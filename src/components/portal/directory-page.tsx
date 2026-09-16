import Image from "next/image";
import Link from "next/link";
import type { Trade } from "@/config/trades";
import { energieheld } from "@/config/energieheld";
import { loadPublicCompanies } from "@/lib/public-companies";
import { filterListings, formatLocation } from "@/lib/listings";
import { AdvertisingLayout } from "./trades";
import { EmptyState } from "./listings";
import { Icon } from "./icon";

export async function DirectoryPage({
  searchParams,
  trade,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  trade?: Trade;
}) {
  const params = await searchParams;
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const filters = {
    query: read("q"),
    category: trade?.id ?? read("kategorie"),
    location: read("ort"),
    service: "",
    sort: read("sort"),
  };
  const loaded = await loadPublicCompanies();
  const results = loaded.data ? filterListings(loaded.data, filters) : [];
  const action = trade ? `/gewerke/${trade.id}` : "/experten";
  return (
    <main id="hauptinhalt" className="container trade-page">
      <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
        <Link href="/">Startseite</Link>
        <span>›</span>
        {trade && (
          <>
            <Link href="/gewerke">Gewerke</Link>
            <span>›</span>
          </>
        )}
        <span>{trade?.name ?? "Experten A–Z"}</span>
      </nav>
      <section className="reference-intro directory-intro">
        <div>
          <p className="eyebrow">Fachbetriebe in München und Bayern</p>
          <h1>{trade?.name ?? "Experten A–Z"}</h1>
          <p>
            {trade?.description ??
              "Finden Sie Handwerker und Fachbetriebe für Ihre Sanierung. Lernen Sie Leistungen, Schwerpunkte und Ansprechpartner in Ihrer Region kennen."}
          </p>
          <p>
            Vom ersten Überblick zum passenden Unternehmensprofil: Vergleichen
            Sie die Fachbetriebe und verfeinern Sie Ihre Auswahl.
          </p>
        </div>
        <div className="reference-image">
          <Image
            src={
              trade ? `/images/trades/${trade.image}.jpg` : "/images/home.jpg"
            }
            alt={trade?.name ?? "Wohnhaus als Symbol für Bauen und Sanieren"}
            fill
            sizes="(max-width:700px) 100vw,55vw"
            priority
          />
        </div>
      </section>
      <AdvertisingLayout>
        <form
          action={action}
          method="get"
          className="directory-search"
          key={JSON.stringify(filters)}
          aria-label="Experten filtern"
        >
          <label>
            Suchbegriff
            <input
              name="q"
              defaultValue={filters.query}
              placeholder="Name oder Tätigkeitsbereich"
            />
          </label>
          <label>
            Gewerk / Kategorie
            <select name="kategorie" defaultValue={filters.category}>
              {!trade && <option value="">Alle Gewerke</option>}
              {(trade ? [trade] : energieheld.categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ort oder Postleitzahl
            <input
              name="ort"
              defaultValue={filters.location}
              placeholder="z. B. München"
            />
          </label>
          <label>
            Sortieren nach
            <select name="sort" defaultValue={filters.sort}>
              <option value="">Standard</option>
              <option value="name">Name A–Z</option>
              <option value="city">Standort A–Z</option>
            </select>
          </label>
          <button className="button button-primary">
            Ergebnisse anzeigen <Icon name="search" size={18} />
          </button>
          <Link className="directory-reset" href={action}>
            Filter zurücksetzen
          </Link>
        </form>
        <div className="results-heading">
          <div>
            <h2>
              {loaded.error ? "" : results.length}{" "}
              {results.length === 1 ? "Fachbetrieb" : "Fachbetriebe"}
              {trade ? ` für ${trade.name}` : ""}
            </h2>
            <p>
              Öffentlich freigegebene Unternehmensprofile · Keine bezahlte
              Reihenfolge
            </p>
          </div>
        </div>
        {loaded.error ? (
          <div className="empty-state" role="alert">
            <p>{loaded.error}</p>
          </div>
        ) : results.length ? (
          <div className="listing-rows">
            {results.map((listing) => (
              <article className="listing-row" key={listing.id}>
                <div
                  className="row-logo"
                  aria-label={`Initialen ${listing.name}`}
                >
                  {listing.initials}
                </div>
                <div className="row-content">
                  <span className="row-category">
                    {energieheld.categories
                      .filter((c) => listing.categoryIds.includes(c.id))
                      .map((c) => c.name)
                      .join(" · ")}
                  </span>
                  <h3>
                    <Link href={`/experten/${listing.slug}`}>
                      {listing.name}
                    </Link>
                  </h3>
                  {formatLocation(listing.location) && (
                    <p className="location">
                      <Icon name="pin" size={16} />
                      {formatLocation(listing.location)}
                    </p>
                  )}
                  <p>{listing.tagline}</p>
                  {listing.businessAreas && <p>{listing.businessAreas}</p>}
                  <div className="row-bottom">
                    <Link
                      className="button button-primary"
                      href={`/experten/${listing.slug}`}
                    >
                      Unternehmensprofil <Icon name="arrow" size={16} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState isDemo={false} />
        )}
      </AdvertisingLayout>
    </main>
  );
}
