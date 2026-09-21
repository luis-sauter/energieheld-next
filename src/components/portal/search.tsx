import Link from "next/link";
import type { Category } from "@/types/portal";
import type { ListingFilters } from "@/lib/listings";
import { Icon } from "./icon";

export function HeroSearch() {
  return (
    <form
      className="hero-search"
      action="/experten"
      method="get"
      aria-label="Expertensuche"
    >
      <label>
        <span>Was möchten Sie angehen?</span>
        <div>
          <Icon name="search" />
          <input name="q" placeholder="Gewerk, Leistung oder Unternehmen" />
        </div>
      </label>
      <label>
        <span>Wo suchen Sie?</span>
        <div>
          <Icon name="pin" />
          <input name="ort" placeholder="Ort oder Postleitzahl" />
        </div>
      </label>
      <button className="button button-primary" type="submit">
        Experten finden
        <Icon name="arrow" />
      </button>
    </form>
  );
}

export function FilterPanel({
  categories,
  services,
  filters,
}: {
  categories: Category[];
  services: string[];
  filters: ListingFilters;
}) {
  return (
    <form
      className="filter-panel"
      action="/experten"
      method="get"
      aria-label="Experten filtern"
      key={JSON.stringify(filters)}
    >
      <div className="filter-heading">
        <h2>Suche verfeinern</h2>
        <Icon name="search" size={19} />
      </div>
      <label htmlFor="query">Suchbegriff</label>
      <input
        id="query"
        name="q"
        defaultValue={filters.query}
        placeholder="Name oder Leistung"
      />
      <label htmlFor="category">Gewerk / Kategorie</label>
      <select id="category" name="kategorie" defaultValue={filters.category}>
        <option value="">Alle Gewerke</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <label htmlFor="location">Ort oder Postleitzahl</label>
      <input
        id="location"
        name="ort"
        defaultValue={filters.location}
        placeholder="z. B. München"
      />
      <label htmlFor="service">Leistung</label>
      <select id="service" name="leistung" defaultValue={filters.service}>
        <option value="">Alle Leistungen</option>
        {services.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <label htmlFor="sort">Sortieren nach</label>
      <select id="sort" name="sort" defaultValue={filters.sort}>
        <option value="">Standard</option>
        <option value="name">Name A–Z</option>
        <option value="city">Standort A–Z</option>
      </select>
      <button className="button button-primary" type="submit">
        Ergebnisse anzeigen
        <Icon name="arrow" size={18} />
      </button>
      <Link href="/experten" className="reset-link">
        Alle Filter zurücksetzen
      </Link>
    </form>
  );
}
