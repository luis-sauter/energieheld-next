"use client";

import type { ReactNode } from "react";
import { Icon } from "./icon";

export function MobileNavigation({ children }: { children: ReactNode }) {
  return (
    <details
      className="mobile-menu"
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
          event.currentTarget.open = false;
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Menü öffnen oder schließen">
        <Icon name="menu" /> Menü
      </summary>
      <nav aria-label="Mobile Hauptnavigation">{children}</nav>
    </details>
  );
}
