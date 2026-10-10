"use client";
import { useState, useTransition } from "react";
import { setProfilePublication, rejectTravelProfile } from "@/app/(energieheld)/admin/actions";
import { canReviewProfile, reviewStatusMessage } from "@/lib/admin-review-state";
import { useTravelReview } from "./travel-review-context";
import styles from "./admin.module.css";

export function ReviewActions({ profileId, status, canReview = false, expectedRevision, listed = true, slug, canPublishDraft = false }: { profileId: string; status: string; canReview?: boolean; expectedRevision?: number; listed?: boolean; slug?: string | null; canPublishDraft?: boolean }) {
  const review = useTravelReview();
  const revision = review?.revision ?? expectedRevision;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [feedback, setFeedback] = useState("");
  const [requestFeedback, setRequestFeedback] = useState(false);
  const unavailable = !canReview ? "Für diese Entscheidung benötigen Sie Portal-Adminrechte." : revision === undefined ? "Der aktuelle Profilstand fehlt. Bitte laden Sie die Profilprüfung neu." : review?.dirty ? "Bitte speichern Sie zuerst die Reisezuordnungen. Ungespeicherte Auswahl wird nicht veröffentlicht." : review?.busy ? "Bitte warten Sie, bis der laufende Vorgang abgeschlossen ist." : null;
  const disabled = pending || Boolean(unavailable) || Boolean(message.success);
  function run(action: () => Promise<{ error?: string; success?: string }>) {
    if (disabled) return;
    setMessage({}); review?.setDeciding(true);
    startTransition(async () => {
      try { setMessage(await action()); }
      catch { setMessage({ error: "Die Prüfung konnte nicht abgeschlossen werden. Bitte laden Sie die Seite neu." }); }
      finally { review?.setDeciding(false); }
    });
  }
  return <div aria-label="Profilentscheidung" aria-busy={pending}>
    {!(status === 'approved' || status === 'draft' && canPublishDraft) && !canReviewProfile(status) && <p>{reviewStatusMessage(status)}</p>}
    {(canReviewProfile(status) || status === 'draft' && canPublishDraft || status === 'approved') && <>
      <p>Prüfen Sie Angaben, Hinweise, Profilgestaltung und gespeicherte Reisezuordnungen. Veröffentlichen Sie das Profil erst, wenn die Vorbereitung abgeschlossen ist.</p>
      {unavailable && <p role="status">{unavailable}</p>}
      {revision === undefined && <button type="button" className="button" onClick={() => window.location.reload()}>Profilprüfung neu laden</button>}
      <div className={styles.actions}>
        {status === 'approved' && listed ? <><span>Veröffentlicht</span>{slug && <a className="button" href={`/unterkuenfte/${slug}`}>Öffentliches Profil öffnen</a>}<button type="button" className="button" disabled={disabled} onClick={() => run(() => setProfilePublication(profileId, false, revision!, review?.proposedKeys))}>Veröffentlichung zurücknehmen</button></> : <button type="button" className="button button-primary" disabled={disabled} onClick={() => run(() => setProfilePublication(profileId, true, revision!, review?.proposedKeys))}>Profil veröffentlichen</button>}
        {canReviewProfile(status) && <button type="button" className="button" disabled={disabled} onClick={() => setRequestFeedback(true)}>Rückfrage an Gastgeber</button>}
      </div>
      {requestFeedback && <form className={styles.reviewFeedback} onSubmit={event => { event.preventDefault(); if (feedback.trim() && feedback.trim().length <= 4000) run(() => rejectTravelProfile(profileId, revision!, feedback, review?.proposedKeys)); }}>
        <label htmlFor="review-feedback">Was soll der Gastgeber ergänzen oder ändern?</label>
        <textarea id="review-feedback" aria-describedby="review-feedback-help" value={feedback} onChange={event => setFeedback(event.target.value)} required maxLength={4000} rows={4} disabled={pending} />
        <p id="review-feedback-help">Formulieren Sie eine konkrete Rückfrage. Maximal 4.000 Zeichen. Nur für den Gastgeber und die Redaktion sichtbar.</p>
        <button className="button button-primary" type="submit" disabled={disabled || !feedback.trim()}>Rückfrage speichern</button>
      </form>}
    </>}
    {status === "approved" && <p>Reisezuordnungen und Profilinhalte können redaktionell bearbeitet werden. Eine erneute Erstfreischaltung ist nicht erforderlich.</p>}
    {pending && <p role="status">Entscheidung wird gespeichert …</p>}
    {message.error && <p role="alert" className={styles.error}>{message.error} <button type="button" className="button" onClick={() => window.location.reload()}>Profilprüfung neu laden</button></p>}
    {message.success && <p role="status" className={styles.success}>{message.success}</p>}
  </div>;
}
