// Presentation only. Server authorization and the RPC enforce review permissions.
export function canReviewProfile(status: string) {
  return status === "pending";
}
