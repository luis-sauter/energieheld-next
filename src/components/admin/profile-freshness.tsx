"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { freshnessStatus, freshnessStates, freshnessContextDate, freshnessDate, freshnessDueDate, type ContentFreshness } from "@/lib/content-freshness";
import { FreshnessStatus } from "./freshness-status";

type Feedback = { error?: string; success?: string };
export function ProfileFreshness({ state, review, withdraw, disabled, compact = false, editableStatus = false }: {
  state: ContentFreshness;
  review?: (revision: number) => Promise<Feedback>;
  withdraw?: (revision: number, reviewedAt: string) => Promise<Feedback>;
  disabled: boolean;
  compact?: boolean;
  editableStatus?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({});
  const status = freshnessStatus(state);
  const action = review ? freshnessStates[status].action : null;
  const canRenew = Boolean(review && status === "Aktuell geprüft");
  const contextDate = freshnessContextDate(state, status);
  const canWithdraw = Boolean(review && withdraw && state.reviewed_at && !state.review_invalidated_at);
  useEffect(() => {
    if (!feedback.success) return;
    const timer = setTimeout(() => setFeedback({}), 4000);
    return () => clearTimeout(timer);
  }, [feedback.success]);
  async function perform(operation: () => Promise<Feedback>) {
    setBusy(true); setFeedback({});
    try { setFeedback(await operation()); }
    catch { setFeedback({ error: "Die Prüfaktion konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." }); }
    finally { setBusy(false); setConfirming(false); router.refresh(); }
  }
  return <section className={compact ? "profile-freshness-compact" : "profile-freshness-editor"} aria-label="Datenqualität">
    <FreshnessStatus status={status} compact={false} />
    {compact ? contextDate && <span className="profile-freshness-date">{contextDate.label}: {freshnessDate(contextDate.date)}</span> : <div className="profile-freshness-metadata">
      {state.reviewed_at && <span>Zuletzt geprüft: {freshnessDate(state.reviewed_at)}</span>}
      {state.review_invalidated_at && <span>Zurückgezogen: {freshnessDate(state.review_invalidated_at)}</span>}
      {!state.review_invalidated_at && state.reviewed_at && state.reviewed_revision === state.content_revision && <span>Nächste Prüfung: {freshnessDate(freshnessDueDate(state.reviewed_at))}</span>}
      {status === "Seit Prüfung geändert" && state.content_updated_at && <span>Geändert: {freshnessDate(state.content_updated_at)} · {({ admin: "Redaktion", provider: "Anbieter", import: "Import", system: "System" })[state.content_update_source ?? "system"]}</span>}
    </div>}
    {!editableStatus && action && <button type="button" className="button" disabled={disabled || busy} onClick={() => perform(() => review!(state.content_revision))}>
      {busy ? "Prüfaktion wird gespeichert …" : action}
    </button>}
    {!editableStatus && (canRenew || canWithdraw) && !confirming && <details className="profile-freshness-menu">
      <summary aria-label="Weitere Prüfaktionen">⋯</summary>
      {canRenew && <button type="button" disabled={disabled || busy} onClick={() => perform(() => review!(state.content_revision))}>{busy ? "Prüfaktion wird gespeichert …" : "Prüfung erneuern"}</button>}
      {canWithdraw && <button type="button" disabled={disabled || busy} onClick={() => { setFeedback({}); setConfirming(true); }}>Prüfung zurückziehen</button>}
    </details>}
    {confirming && <div className="profile-freshness-confirm" role="group" aria-label="Prüfung zurückziehen bestätigen">
      <p>Der aktuelle Prüfstatus wird zurückgezogen. Das Profil erscheint anschließend wieder unter „Prüfung erforderlich“. Fortfahren?</p>
      <button type="button" className="button" disabled={disabled || busy} onClick={() => perform(() => withdraw!(state.content_revision, state.reviewed_at!))}>{busy ? "Prüfaktion wird gespeichert …" : "Rücknahme bestätigen"}</button>
      <button type="button" className="button" disabled={busy} onClick={() => setConfirming(false)}>Rücknahme abbrechen</button>
    </div>}
    {editableStatus && review && <ReviewStatusControl key={`${state.content_revision}:${state.reviewed_at}:${state.review_invalidated_at}`}
      reviewed={!freshnessStates[status].needsReview} disabled={disabled || busy} canWithdraw={canWithdraw}
      save={(reviewed) => { if (reviewed) void perform(() => review(state.content_revision)); else setConfirming(true); }} /> }
    {editableStatus && !review && <small>Sie können das Profil bearbeiten; die Prüfentscheidung benötigt die gesonderte redaktionelle Prüfberechtigung.</small>}
    {editableStatus && disabled && <small>Speichern Sie zuerst offene Profil- oder Reiseänderungen, bevor Sie den Prüfstatus bestätigen.</small>}
    {!compact && action && <small>Speichern bestätigt keine Prüfung.</small>}
    {feedback.error && <p role="alert">{feedback.error}</p>}
    {feedback.success && <p role="status">{feedback.success}</p>}
  </section>;
}

function ReviewStatusControl({ reviewed, disabled, canWithdraw, save }: { reviewed: boolean; disabled: boolean; canWithdraw: boolean; save: (reviewed: boolean) => void }) {
  const [selected, setSelected] = useState(reviewed);
  return <fieldset className="profile-review-choice" disabled={disabled}>
    <legend>Prüfstatus ändern</legend>
    <label><input type="radio" name="profile-review-status" checked={!selected} onChange={() => setSelected(false)} />Prüfung erforderlich</label>
    <label><input type="radio" name="profile-review-status" checked={selected} onChange={() => setSelected(true)} />Bereits geprüft</label>
    <button type="button" className="button button-primary" disabled={selected === reviewed || (!selected && !canWithdraw)} onClick={() => save(selected)}>Prüfstatus speichern</button>
  </fieldset>;
}
