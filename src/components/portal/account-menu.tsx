"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logout } from "@/app/(energieheld)/auth-actions";
import type { EditorialCounts } from "@/lib/editorial-queue";
import type { AdminAccess } from "@/lib/admin-review";

export type AccountIdentity = { name?: string; email?: string; initials: string };
const accountLinks = [
  { label: "Firmenbereich", href: "/firma" },
  { label: "Profil bearbeiten", href: "/firma/profil" },
  { label: "Anfragen", href: "/firma/anfragen" },
  { label: "Angebotsanfragen", href: "/firma/werbung" },
  { label: "Statistiken", href: "/firma/statistiken" },
];
const adminLinks = [{ label: "Redaktion", href: "/admin" }];
export function accountMenuGroups(access: AdminAccess, hasCompany = false) {
  return access === "unauthenticated" ? { account: [{ label: "Einloggen", href: "/login" }], administration: [] }
    : { account: hasCompany ? accountLinks : access === "admin" ? [] : [{ label: "Mein Konto", href: "/konto" }], administration: access === "admin" ? adminLinks : [] };
}

export function AccountMenu({ access, identity, hasCompany = false, taskCounts, taskError }: { access: AdminAccess; identity?: AccountIdentity; hasCompany?: boolean; taskCounts?: EditorialCounts; taskError?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(logout, {});
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLink.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const counts = access === "admin" ? taskCounts : undefined;
  const total = counts?.total ?? 0;
  const countFor = (href: string) => href === "/admin" ? counts?.total : undefined;
  const signedIn = access !== "unauthenticated";
  const groups = accountMenuGroups(access, hasCompany);
  return <div className="account-menu" ref={root}>
    <button ref={button} type="button" className="account-trigger" aria-label={open ? "Kontomenü schließen" : "Kontomenü öffnen"} aria-description={total > 0 ? `${total} offene Redaktionsaufgaben` : access === "admin" && taskError ? "Aufgabenzähler nicht verfügbar" : undefined} aria-expanded={open} aria-controls="portal-account-menu" onClick={() => setOpen(!open)}>
      {signedIn ? <span aria-hidden="true">{identity?.initials || "K"}</span> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c.5-4 3-6 7.5-6s7 2 7.5 6"/></svg>}
      {total > 0 && <span className="account-task-badge" aria-label={`${total} offene Redaktionsaufgaben`}>{total > 99 ? "99+" : total}</span>}
    </button>
    {open && <div id="portal-account-menu" className="account-panel">
      {signedIn ? <>
        <div className="account-identity"><strong>{identity?.name || "Mein Konto"}</strong>{identity?.email && <span>{identity.email}</span>}</div>
        <nav aria-label="Konto" onClick={() => setOpen(false)}>
          {groups.account.length > 0 && <span className="account-group-label">{hasCompany ? "Mein Unternehmen" : "Konto"}</span>}
          {groups.account.map((link, index) => <Link key={link.href} ref={index === 0 ? firstLink : undefined} href={link.href}>{link.label}</Link>)}
          {groups.administration.length > 0 && <>
            <span className="account-group-label account-divider">Administration</span>
            {groups.administration.map((link, index) => <Link key={link.href} ref={groups.account.length === 0 && index === 0 ? firstLink : undefined} href={link.href}>{link.label}{countFor(link.href) !== undefined ? ` (${countFor(link.href)})` : ""}</Link>)}
            {taskError && <p role="alert">Aufgabenzähler nicht verfügbar. Bitte neu laden.</p>}
          </>}
        </nav>
        <form className="account-logout account-divider" action={action}>
          <button type="submit" disabled={pending}>{pending ? "Wird abgemeldet …" : "Ausloggen"}</button>
          {state.error && <span role="alert">{state.error}</span>}
        </form>
      </> : <nav aria-label="Konto"><Link ref={firstLink} href={groups.account[0].href} onClick={() => setOpen(false)}>{groups.account[0].label}</Link></nav>}
    </div>}
  </div>;
}
