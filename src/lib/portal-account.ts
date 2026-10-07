import type { AdminAccess } from "./admin-review";

export type PortalAccount = { access: AdminAccess; hasCompany: boolean };

export function accountCta({ access, hasCompany }: PortalAccount) {
  if (access === "admin") return { label: "Adminbereich", href: "/admin" };
  if (access !== "unauthenticated" && hasCompany) return { label: "Mein Firmenbereich", href: "/firma" };
  if (access !== "unauthenticated") return { label: "Mein Konto", href: "/konto" };
  return { label: "Unterkunft eintragen", href: "/fuer-unternehmen" };
}

const ownerPaths = new Set(["/firma", "/firma/profil", "/firma/anfragen", "/firma/werbung", "/firma/statistiken"]);
const adminPaths = new Set(["/admin", "/admin/werbung"]);
export function safeAccountReturnPath(value: unknown, account: PortalAccount) {
  if (typeof value !== "string" || account.access === "unauthenticated") return null;
  // Exact allowlist: no external URLs, encoding tricks, queries or subpaths.
  if (ownerPaths.has(value) && account.hasCompany) return value;
  if (adminPaths.has(value) && account.access === "admin") return value;
  return null;
}
export function accountLoginDestination(account: PortalAccount, next?: unknown) {
  return safeAccountReturnPath(next, account) ?? (account.access === "admin" ? "/admin" : account.hasCompany ? "/firma" : "/konto");
}
