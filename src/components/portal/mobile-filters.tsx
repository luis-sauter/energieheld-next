"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./icon";

export function MobileFilters({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? "responsive-filters is-open" : "responsive-filters"}>
      <button
        className="button button-outline filter-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="directory-filters"
        onClick={() => setOpen(!open)}
      >
        <Icon name="search" size={18} />
        {open ? "Filter schließen" : "Suche & Filter öffnen"}
      </button>
      <div id="directory-filters" className="filter-content">
        {children}
      </div>
    </div>
  );
}
