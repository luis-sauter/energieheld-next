import "server-only";
import { notFound, redirect } from "next/navigation";
import type { AdminAccess } from "./admin-review";

// Used by pages and Server Actions after checkAdmin has verified the current user.
export function requireAdminAccess(access: AdminAccess) {
  if (access === "unauthenticated") redirect("/login");
  if (access !== "admin") notFound();
}

export function formatSubmission(value: string | null) {
  if (!value) return "Noch nicht eingereicht";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Datum nicht verfügbar";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

// PostgREST infers an array without generated DB types; the FK is many-to-one.
export function legalName(
  company: { legal_name: string } | { legal_name: string }[] | null,
) {
  return (
    (Array.isArray(company) ? company[0]?.legal_name : company?.legal_name) ??
    "Firmenname nicht verfügbar"
  );
}
