"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HeaderNavigationItem } from "./navigation-data";

export function DesktopNavigation({ items }: { items: HeaderNavigationItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusFirst = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (focusFirst.current) {
      root.current?.querySelector<HTMLAnchorElement>(`#desktop-nav-${open.slice(1)} a`)?.focus();
      focusFirst.current = false;
    }
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(null);
      buttons.current[open]?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <nav ref={root} className="desktop-nav" aria-label="Hauptnavigation">
    {items.map((item) => item.children?.length ? <div className="desktop-nav-group" key={item.href}>
      <Link href={item.href} onClick={() => setOpen(null)}>{item.label}</Link>
      <button type="button" className="nav-chevron-button"
        ref={(node) => { buttons.current[item.href] = node; }}
        aria-label={`${item.label}: Untermenü ${open === item.href ? "schließen" : "öffnen"}`}
        aria-expanded={open === item.href} aria-haspopup="menu"
        aria-controls={`desktop-nav-${item.href.slice(1)}`}
        onClick={() => setOpen((current) => current === item.href ? null : item.href)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (open === item.href) {
              const links = root.current?.querySelectorAll<HTMLAnchorElement>(`#desktop-nav-${item.href.slice(1)} a`);
              links?.[event.key === "ArrowDown" ? 0 : links.length - 1]?.focus();
            } else {
              focusFirst.current = true;
              setOpen(item.href);
            }
          }
        }}>
        <span className="nav-chevron" aria-hidden="true" />
      </button>
      {open === item.href && <div id={`desktop-nav-${item.href.slice(1)}`}
        className="desktop-nav-panel" role="menu" aria-label={item.label}
        onKeyDown={(event) => {
          const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
          const index = links.indexOf(document.activeElement as HTMLAnchorElement);
          const next = event.key === "ArrowDown" ? (index + 1) % links.length
            : event.key === "ArrowUp" ? (index - 1 + links.length) % links.length
            : event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : -1;
          if (next >= 0) {
            event.preventDefault();
            links[next]?.focus();
          }
        }}>
        {item.children.map((child) => <Link key={child.href} href={child.href} role="menuitem"
          onClick={() => setOpen(null)}>{child.label}</Link>)}
      </div>}
    </div> : <Link key={item.href} href={item.href}>{item.label}</Link>)}
  </nav>;
}
