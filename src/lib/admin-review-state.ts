// Presentation only. Server authorization and the RPC enforce review permissions.
export function canReviewProfile(status: string) {
  return status === "pending";
}

export function reviewStatusMessage(status: string) {
  const messages: Record<string, string> = {
    approved: "Dieses Profil wurde freigegeben.",
    rejected: "Für dieses Profil wurden Änderungen angefordert.",
    draft: "Dieses Profil wurde noch nicht zur Prüfung eingereicht.",
  };
  return (
    messages[status] ??
    (status === "pending"
      ? ""
      : "Dieses Profil kann derzeit nicht geprüft werden.")
  );
}
