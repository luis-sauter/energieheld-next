"use client";
import { Children, cloneElement, isValidElement, useMemo, useState, type ReactNode } from "react";
import { MediaLibraryCompanyPicker } from "../admin/media-library-company-picker";
import { localCompanySearchCache, normalizedCompanyName } from "@/lib/media-library-company-cache";
import type { BannerAdvertiserOption } from "@/lib/banner-search-metadata";

export function BannerAdvertiserPicker({ value, name, advertisers, onChange }: {
  value: string; name: string; advertisers: BannerAdvertiserOption[]; onChange: (key: string) => void;
}) {
  const cache = useMemo(() => localCompanySearchCache(advertisers.map(row => ({
    id: row.key, display_name: row.name + (row.profile_id ? " · Firmenprofil" : ""),
  }))), [advertisers]);
  return <MediaLibraryCompanyPicker value={value} name={name} disabled={false} searchCache={cache}
    label="Werbekunde / Firmenprofil" emptyLabel="Neuer oder eigenständiger Werbekunde" allowCreate={false}
    onChange={company => onChange(company.id)} />;
}

export function BannerCategoryFilter({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <>
    <label>Kategorien suchen<input type="search" value={query} maxLength={80}
      placeholder="Kategorie oder Teilbegriff" onChange={event => setQuery(event.target.value)}
      onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} /></label>
    {Children.map(children, child => {
      if (!isValidElement<{ "data-search-label": string; hidden?: boolean }>(child)) return child;
      return cloneElement(child, { hidden: !normalizedCompanyName(child.props["data-search-label"]).includes(normalizedCompanyName(query)) });
    })}
  </>;
}
