import { freshnessStates, type FreshnessStatus as Status } from "@/lib/content-freshness";

export function FreshnessStatus({ status, compact = true }: { status: Status; compact?: boolean }) {
  return <span className="admin-freshness-status" title={status}><span aria-hidden="true">{freshnessStates[status].symbol}</span> {compact ? freshnessStates[status].label : status}</span>;
}
