"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "./icon";
import type { HeaderNavigationItem } from "./navigation-data";

export function MobileNavigation({ items }: { items: HeaderNavigationItem[] }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  return (
    <details
      className="mobile-menu"
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
          event.currentTarget.open = false;
          setOpenGroup(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          if (openGroup) {
            setOpenGroup(null);
            event.currentTarget.querySelector<HTMLButtonElement>(`[data-mobile-nav-group="${openGroup}"]`)?.focus();
            return;
          }
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Menü öffnen oder schließen">
        <Icon name="menu" /> Menü
      </summary>
      <nav aria-label="Mobile Hauptnavigation">
        {items.map((item) => <div className="mobile-nav-group" key={item.href}>
          <div className="mobile-nav-row">
            <Link href={item.href}>{item.label}</Link>
            {item.children?.length ? <button type="button" className="nav-chevron-button"
              data-mobile-nav-group={item.href}
              aria-label={`${item.label}: Untermenü ${openGroup === item.href ? "schließen" : "öffnen"}`}
              aria-expanded={openGroup === item.href}
              aria-controls={`mobile-nav-${item.href.slice(1)}`}
              onClick={() => setOpenGroup((current) => current === item.href ? null : item.href)}>
              <span className="nav-chevron" aria-hidden="true" />
            </button> : null}
          </div>
          {item.children?.length && openGroup === item.href ? <div id={`mobile-nav-${item.href.slice(1)}`}
            className="mobile-nav-submenu" aria-label={item.label}>
            {item.children.map((child) => <Link key={child.href} href={child.href}>{child.label}</Link>)}
          </div> : null}
        </div>)}
        <Link className="button header-cta" href="/registrieren">Unterkunft eintragen</Link>
      </nav>
    </details>
  );
}
