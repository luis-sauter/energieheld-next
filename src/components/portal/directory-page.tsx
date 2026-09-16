import Image from "next/image";
import Link from "next/link";
import type { Trade } from "@/config/trades";
import { energieheld } from "@/config/energieheld";
import { listings } from "@/data/listings";
import { filterListings } from "@/lib/listings";
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
    service: read("leistung"),
    sort: read("sort"),
  };
  const results = filterListings(listings, filters);
  const action = trade ? `/gewerke/${trade.id}` : "/experten";
  const services = [
    ...new Set(
      listings
        .filter((l) => !trade || l.categoryIds.includes(trade.id))
        .flatMap((l) => l.services),
    ),
  ].sort((a, b) => a.localeCompare(b, "de"));
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
            Sie die Beispielbetriebe und verfeinern Sie Ihre Auswahl.
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
              placeholder="Name oder Leistung"
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
            Leistung
            <select name="leistung" defaultValue={filters.service}>
              <option value="">Alle Leistungen</option>
              {services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
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
              {results.length}{" "}
              {results.length === 1 ? "Fachbetrieb" : "Fachbetriebe"}
              {trade ? ` für ${trade.name}` : ""}
            </h2>
            <p>Fiktive Einträge zur Vorschau · Keine bezahlte Reihenfolge</p>
          </div>
        </div>
        {results.length ? (
          <div className="listing-rows">
            {results.map((listing) => (
              <article className="listing-row" key={listing.id}>
                <div
                  className="row-logo"
                  aria-label={`Beispiellogo ${listing.name}`}
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
                  <p className="location">
                    <Icon name="pin" size={16} />
                    {listing.location.postalCode} {listing.location.city},{" "}
                    {listing.location.country}
                  </p>
                  <p>{listing.tagline}</p>
                  <div className="card-services">
                    {listing.services.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                  <div className="row-bottom">
                    <Link
                      className="button button-primary"
                      href={`/experten/${listing.slug}`}
                    >
                      Unternehmensprofil <Icon name="arrow" size={16} />
                    </Link>
                    <span>Beispielprofil</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </AdvertisingLayout>
    </main>
  );
}
