import type { freshnessStatus } from "@/lib/content-freshness";

export const freshnessSymbols = {
  "Noch nicht geprüft": "○",
  "Seit Prüfung geändert": "●",
  "Prüfung überfällig": "⚠",
  "Aktuell geprüft": "✓",
} satisfies Record<ReturnType<typeof freshnessStatus>, string>;

export function FreshnessStatus({ status }: { status: keyof typeof freshnessSymbols }) {
  return <span className="admin-freshness-status"><span aria-hidden="true">{freshnessSymbols[status]}</span> {status}</span>;
}
