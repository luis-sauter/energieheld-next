export type ContentFreshness = {
  content_revision: number;
  content_updated_at: string | null;
  content_update_source: "admin" | "provider" | "import" | "system" | null;
  reviewed_revision: number | null;
  reviewed_at: string | null;
};
export type PublicFreshness = { content_updated_at: string | null; checked_at: string | null };
export function freshnessStatus(state: ContentFreshness, now = new Date()) {
  if (!state.reviewed_at) return "Noch nicht geprüft";
  if (state.reviewed_revision !== state.content_revision) return "Seit Prüfung geändert";
  return now > new Date(freshnessDueDate(state.reviewed_at)) ? "Prüfung überfällig" : "Aktuell geprüft";
}
export function freshnessDueDate(reviewedAt: string) {
  const due = new Date(reviewedAt);
  const month = due.getUTCMonth();
  due.setUTCFullYear(due.getUTCFullYear() + 1);
  if (due.getUTCMonth() !== month) due.setUTCDate(0);
  return due.toISOString();
}
export function freshnessDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}
export function publicFreshnessLabel(state?: PublicFreshness) {
  const date = state?.checked_at ?? state?.content_updated_at;
  return date ? { date, label: state?.checked_at ? "Zuletzt geprüft" : "Zuletzt aktualisiert" } : null;
}
