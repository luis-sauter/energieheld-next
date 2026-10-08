export type ContentFreshness = {
  content_revision: number;
  content_updated_at: string | null;
  content_update_source: "admin" | "provider" | "import" | "system" | null;
  reviewed_revision: number | null;
  reviewed_at: string | null;
  review_invalidated_at?: string | null;
};
export type PublicFreshness = { content_updated_at: string | null; checked_at: string | null };
export function freshnessStatus(state: ContentFreshness, now = new Date()) {
  if (!state.reviewed_at) return "Noch nicht geprüft";
  if (state.review_invalidated_at) return "Prüfung erforderlich";
  if (state.reviewed_revision !== state.content_revision) return "Seit Prüfung geändert";
  return now > new Date(freshnessDueDate(state.reviewed_at)) ? "Prüfung überfällig" : "Aktuell geprüft";
}
export type FreshnessStatus = ReturnType<typeof freshnessStatus>;
export const freshnessStates = {
  "Noch nicht geprüft": { label: "Ungeprüft", symbol: "○", needsReview: true, action: "Als geprüft markieren" },
  "Seit Prüfung geändert": { label: "Geändert", symbol: "●", needsReview: true, action: "Aktuellen Stand als geprüft markieren" },
  "Prüfung überfällig": { label: "Überfällig", symbol: "⚠", needsReview: true, action: "Erneut prüfen" },
  "Aktuell geprüft": { label: "Geprüft", symbol: "✓", needsReview: false, action: null },
  "Prüfung erforderlich": { label: "Prüfung erforderlich", symbol: "!", needsReview: true, action: "Aktuellen Stand als geprüft markieren" },
} satisfies Record<FreshnessStatus, { label: string; symbol: string; needsReview: boolean; action: string | null }>;
export function freshnessMatches(status: FreshnessStatus | undefined, filter: string) {
  return !filter || Boolean(status && (filter === "needs-review" ? freshnessStates[status].needsReview : filter === "reviewed" ? !freshnessStates[status].needsReview : status === filter));
}
export function freshnessCounts(statuses: (FreshnessStatus | undefined)[]) {
  const counts = Object.fromEntries(Object.keys(freshnessStates).map(status => [status, 0])) as Record<FreshnessStatus, number>;
  let needsReview = 0;
  for (const status of statuses) if (status) {
    counts[status]++;
    if (freshnessStates[status].needsReview) needsReview++;
  }
  return { counts, needsReview };
}
export function freshnessContextDate(state: ContentFreshness, status = freshnessStatus(state)) {
  if (status === "Seit Prüfung geändert") return state.content_updated_at ? { label: "Geändert", date: state.content_updated_at } : null;
  if (status === "Prüfung erforderlich") return state.review_invalidated_at ? { label: "Prüfung zurückgezogen", date: state.review_invalidated_at } : null;
  return state.reviewed_at ? { label: "Zuletzt geprüft", date: state.reviewed_at } : null;
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

export function editorialReviewLabel(status: FreshnessStatus) { return freshnessStates[status].needsReview ? "Prüfung erforderlich" : "Bereits geprüft"; }
