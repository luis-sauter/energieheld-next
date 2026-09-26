import Image from "next/image";
import Link from "next/link";
import type { Trade } from "@/config/trades";
import { energieheld } from "@/config/energieheld";
import { loadPortalCompanies } from "@/lib/portal-companies";
import { loadReiseportalDirectory } from "@/lib/reiseportal-directory";
import { filterListings } from "@/lib/listings";
import { AdvertisingLayout } from "./trades";
import { EmptyState } from "./listings";
import { ListingRow } from "./listing-row";
import { Icon } from "./icon";
import { loadPublicAds } from "@/lib/public-ads";
import { loadPublicSidebarOrder } from "@/lib/public-sidebar-order";
import type { SidebarSlot } from "@/lib/sidebar-order";
import { destinations, travelThemes } from "@/data/reiseportal-discovery";
import { filterTravelDiscovery } from "@/lib/reiseportal-search";

export async function DirectoryPage({
  searchParams,
  trade,
  mode = "energy",
  canReorder = false,
  saveOrder,
  saveSidebarOrder,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  trade?: Trade;
  mode?: "energy" | "travel";
  canReorder?: boolean;
  saveOrder?: (ids: string[]) => Promise<{ success?: string; error?: string }>;
  saveSidebarOrder?: (slots: SidebarSlot[]) => Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const travel = mode === "travel";
  const filters = {
    query: read("q"),
    category: travel ? "" : trade?.id ?? read("kategorie"),
    location: read("ort"),
    service: "",
    sort: read("sort"),
  };
  const destination = travel ? read("ziel") : "";
  const theme = travel ? read("thema") : "";
  const audience = travel ? read("zielgruppe") : "";
  const accommodation = travel ? read("unterkunftstyp") : "";
  const feature = travel ? read("besonderheit") : "";
  const [loaded, ads, sidebarOrder] = await Promise.all([
    travel ? loadReiseportalDirectory() : loadPortalCompanies(),
    loadPublicAds(trade?.id),
    loadPublicSidebarOrder(),
  ]);
  const preview = "preview" in loaded ? loaded.preview : [];
  const database = "database" in loaded ? loaded.database : loaded.data ?? [];
  const assignedTerms = new Set(database.flatMap((listing) => listing.travelTermKeys ?? []));
  const audienceOptions = [
    ["paar", "Paar"], ["familie", "Familie"], ["mit-hund", "Mit Hund"], ["gruppe", "Gruppe"],
  ].filter(([slug]) => assignedTerms.has(`audience:${slug}`));
  const accommodationOptions = [
    ["hotel", "Hotel"], ["ferienwohnung", "Ferienwohnung"],
    ["pension", "Pension"], ["camping", "Camping"],
  ].filter(([slug]) => assignedTerms.has(`accommodation:${slug}`));
  const featureOptions = [...assignedTerms].filter((key) => key.startsWith("feature:"))
    .map((key) => key.slice("feature:".length)).sort();
  const travelFilter = (items: typeof database) => filterTravelDiscovery(
    filterListings(items, filters), destination, theme, audience, accommodation, feature,
  );
  const previewResults = travelFilter(preview);
  const databaseResults = travel
    ? travelFilter(database)
    : filterListings(database, filters);
  const sortedTravel = travel && Boolean(filters.sort);
  const results = sortedTravel
    ? travelFilter([...preview, ...database])
    : [...previewResults, ...databaseResults];
  const showOrderEditor = Boolean(
    canReorder && !trade && !Object.values(filters).some(Boolean) && !destination && !theme &&
      !audience && !accommodation && !feature && saveOrder && saveSidebarOrder,
  );
  const OrderEditor = showOrderEditor && (!travel || databaseResults.length > 0)
    ? (await import("@/components/admin/directory-order-editor")).DirectoryOrderEditor
    : null;
  const SidebarEditor = showOrderEditor
    ? (await import("@/components/admin/sidebar-order-editor")).SidebarOrderEditor
    : null;
  const action = travel ? "/unterkuenfte-a-z" : trade ? `/gewerke/${trade.id}` : "/experten";
  const categories = travel ? [] : energieheld.categories;
  const profilePath = travel ? "/unterkuenfte" : "/experten";
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
        <span>{travel ? "Unterkünfte A–Z" : trade?.name ?? "Experten A–Z"}</span>
      </nav>
      <section className="reference-intro directory-intro">
        <div>
          {travel ? <>
            <p className="eyebrow">Unterkünfte im deutschsprachigen Raum</p>
            <h1>Unterkünfte A–Z</h1>
            <p>Eine Übersicht über Unterkünfte im deutschsprachigen Raum.</p>
          </> : <>
            <p className="eyebrow">Fachbetriebe in München und Bayern</p>
            <h1>{trade?.name ?? "Experten A–Z"}</h1>
            <p>{trade?.description ?? "Finden Sie Handwerker und Fachbetriebe für Ihre Sanierung. Lernen Sie Leistungen, Schwerpunkte und Ansprechpartner in Ihrer Region kennen."}</p>
            <p>Vom ersten Überblick zum passenden Unternehmensprofil: Vergleichen Sie die Fachbetriebe und verfeinern Sie Ihre Auswahl.</p>
          </>}
        </div>
        <div className="reference-image">
          <Image
            src={
              travel ? "/images/mountains.svg" : trade ? `/images/trades/${trade.image}.jpg` : "/images/home.jpg"
            }
            alt={travel ? "Berglandschaft" : trade?.name ?? "Wohnhaus als Symbol für Bauen und Sanieren"}
            fill
            sizes="(max-width:700px) 100vw,55vw"
            priority
          />
        </div>
      </section>
      <AdvertisingLayout
        ads={ads}
        sidebarOrder={sidebarOrder}
        editorEnabled={showOrderEditor}
        sidebarEditor={SidebarEditor && saveSidebarOrder
          ? <SidebarEditor ads={ads} slots={sidebarOrder} saveOrder={saveSidebarOrder} />
          : undefined}
      >
        <form
          action={action}
          method="get"
          className="directory-search"
          key={JSON.stringify([filters, destination, theme, audience, accommodation, feature])}
          aria-label={travel ? "Unterkünfte filtern" : "Experten filtern"}
        >
          {travel && <>
            <label>Wohin?
              <select name="ziel" defaultValue={destination}>
                <option value="">Alle Reiseziele</option>
                {destinations.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}
              </select>
            </label>
            <label>Reiseart
              <select name="thema" defaultValue={theme}>
                <option value="">Alle Reisearten</option>
                {travelThemes.filter((entry) => entry.previewSlugs.length > 0).map((entry) =>
                  <option key={entry.slug} value={entry.slug}>{entry.title}</option>)}
              </select>
            </label>
            {audienceOptions.length > 0 && <label>Mit wem?
              <select name="zielgruppe" defaultValue={audience}>
                <option value="">Alle Zielgruppen</option>
                {audienceOptions.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
              </select>
            </label>}
            {accommodationOptions.length > 0 && <label>Unterkunftstyp
              <select name="unterkunftstyp" defaultValue={accommodation}>
                <option value="">Alle Unterkunftstypen</option>
                {accommodationOptions.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
              </select>
            </label>}
            {featureOptions.length > 0 && <label>Besonderheit
              <select name="besonderheit" defaultValue={feature}>
                <option value="">Alle Besonderheiten</option>
                {featureOptions.map((slug) => <option key={slug} value={slug}>{slug.replaceAll("-", " ")}</option>)}
              </select>
            </label>}
          </>}
          <label>
            Suchbegriff
            <input
              name="q"
              defaultValue={filters.query}
              placeholder={travel ? "Name der Unterkunft" : "Name oder Tätigkeitsbereich"}
            />
          </label>
          {!travel && <label>
            Gewerk / Kategorie
            <select name="kategorie" defaultValue={filters.category}>
              {!trade && <option value="">Alle Gewerke</option>}
              {(trade ? [trade] : energieheld.categories).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>}
          <label>
            Ort oder Postleitzahl
            <input
              name="ort"
              defaultValue={filters.location}
              placeholder={travel ? "Ort oder Postleitzahl" : "z. B. München"}
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
              {travel || !loaded.error ? results.length : ""}{" "}
              {travel ? (results.length === 1 ? "Unterkunft" : "Unterkünfte") : results.length === 1 ? "Fachbetrieb" : "Fachbetriebe"}
              {!travel && trade ? ` für ${trade.name}` : ""}
            </h2>
            <p>
              {travel ? "Ausgewählte Anbieter aus dem bestehenden Reiseportal · Demo/Testprofil gekennzeichnet" : "Unternehmensprofile und gekennzeichnete Beispielprofile · Keine bezahlte Reihenfolge"}
            </p>
          </div>
        </div>
        {loaded.error && (
          <div className="empty-state" role="alert">
            <p>{loaded.error}</p>
          </div>
        )}
        {travel && !sortedTravel && previewResults.length > 0 && <div className="listing-rows">
          {previewResults.map((listing) => <ListingRow key={listing.id} listing={listing} categories={categories}
            href={`${profilePath}/${listing.slug}`} showVerification={false} />)}
        </div>}
        {sortedTravel ? (
          <div className="listing-rows">
            {results.map((listing) => <ListingRow key={listing.id} listing={listing} categories={categories}
              href={`${profilePath}/${listing.slug}`} showVerification={false} />)}
          </div>
        ) : !loaded.error && OrderEditor && saveOrder ? (
          <OrderEditor listings={databaseResults} hiddenDemoKeys={"hiddenOrderKeys" in loaded ? loaded.hiddenOrderKeys : "hiddenDemoKeys" in loaded ? loaded.hiddenDemoKeys : []}
            saveOrder={saveOrder} categories={categories} basePath={profilePath} showVerification={!travel} />
        ) : databaseResults.length ? (
          <div className="listing-rows">
            {databaseResults.map((listing) => (
              <ListingRow
                key={listing.id}
                listing={listing}
                categories={categories}
                href={`${profilePath}/${listing.slug}`}
                showVerification={!travel}
              />
            ))}
          </div>
        ) : !loaded.error && !results.length ? (
          <EmptyState isDemo={false} travel={travel} />
        ) : null}
      </AdvertisingLayout>
    </main>
  );
}
