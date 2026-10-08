import { freshnessStates, editorialReviewLabel, type FreshnessStatus as Status } from "@/lib/content-freshness";

export function FreshnessStatus({ status }: { status: Status; compact?: boolean }) {
  return <span className="admin-freshness-status" title={status}><span aria-hidden="true">{freshnessStates[status].symbol}</span> {editorialReviewLabel(status)}</span>;
}
