"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { freshnessStatus, freshnessDate, freshnessDueDate, type ContentFreshness } from "@/lib/content-freshness";

export function ProfileFreshness({ state, review, disabled }: {
  state: ContentFreshness;
  review: (revision: number) => Promise<{ error?: string; success?: string }>;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  return <section className="profile-freshness-editor" aria-label="Datenqualität">
    <strong>Datenqualität: {freshnessStatus(state)}</strong>
    {state.content_updated_at && <p>Zuletzt geändert: {freshnessDate(state.content_updated_at)} · {({ admin: "Redaktion", provider: "Anbieter", import: "Import", system: "System" })[state.content_update_source ?? "system"]}</p>}
    {state.reviewed_at && <p>Zuletzt geprüft: {freshnessDate(state.reviewed_at)}</p>}
    {state.reviewed_at && state.reviewed_revision === state.content_revision && <p>Nächste Prüfung: {freshnessDate(freshnessDueDate(state.reviewed_at))}</p>}
    <p>Prüfen Sie den gesamten gespeicherten Profilinhalt. Speichern allein bestätigt keine Prüfung.</p>
    <button type="button" className="button" disabled={disabled || busy} onClick={async () => {
      setBusy(true); setFeedback({});
      try { setFeedback(await review(state.content_revision)); }
      catch { setFeedback({ error: "Die Prüfung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." }); }
      finally { setBusy(false); router.refresh(); }
    }}>{busy ? "Prüfung wird gespeichert …" : "Als geprüft markieren"}</button>
    {feedback.error && <p role="alert">{feedback.error}</p>}
    {feedback.success && <p role="status">{feedback.success}</p>}
  </section>;
}
