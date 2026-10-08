"use client";

import { useState, useTransition } from "react";
import { approveTravelProfile, rejectTravelProfile } from "@/app/(energieheld)/admin/actions";
import { canReviewProfile, reviewStatusMessage } from "@/lib/admin-review-state";
import styles from "./admin.module.css";

export function ReviewActions({ profileId, status, canReview = false, expectedRevision }: { profileId: string; status: string; canReview?: boolean; expectedRevision?: number }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [feedback, setFeedback] = useState("");
  const [requestFeedback, setRequestFeedback] = useState(false);
  function run(action: () => Promise<{ error?: string; success?: string }>) {
    setMessage({});
    startTransition(async () => {
      try { setMessage(await action()); }
      catch { setMessage({ error: "Die Prüfung konnte nicht abgeschlossen werden. Bitte laden Sie die Seite neu." }); }
    });
  }
  return <div aria-label="Profilentscheidung" aria-busy={pending}>
    {!canReviewProfile(status) && <p>{reviewStatusMessage(status)}</p>}
    {canReviewProfile(status) && <>
      <p>Schließen Sie die Prüfung erst ab, nachdem Angaben, Profilgestaltung und Reisezuordnungen geprüft wurden.</p>
      {!canReview && <p>Für die Freischaltung ist eine gesonderte Freigabeberechtigung erforderlich.</p>}
      <div className={styles.actions}>
        <button type="button" className="button button-primary" disabled={pending || !canReview || expectedRevision === undefined || Boolean(message.success)} onClick={() => run(() => approveTravelProfile(profileId, expectedRevision!))}>Firma erstmalig freischalten</button>
        <button type="button" className="button" disabled={pending || !canReview || Boolean(message.success)} onClick={() => setRequestFeedback(true)}>Rückfrage erforderlich</button>
      </div>
      {requestFeedback && <form className={styles.reviewFeedback} onSubmit={event => { event.preventDefault(); run(() => rejectTravelProfile(profileId, expectedRevision!, feedback)); }}>
        <label htmlFor="review-feedback">Hinweis der Redaktion</label><textarea id="review-feedback" value={feedback} onChange={event => setFeedback(event.target.value)} required maxLength={4000} rows={4} disabled={pending} />
        <p>Diese Rückmeldung ist nur für den Firmeninhaber und die Redaktion sichtbar.</p>
        <button className="button button-primary" type="submit" disabled={pending || !canReview || expectedRevision === undefined || !feedback.trim()}>Rückfrage senden</button>
      </form>}
    </>}
    {status === "approved" && <p>Reisezuordnungen und Profilinhalte können redaktionell bearbeitet werden. Eine erneute Erstfreischaltung ist nicht erforderlich.</p>}
    {pending && <p role="status">Entscheidung wird gespeichert …</p>}
    {message.error && <p role="alert" className={styles.error}>{message.error}</p>}
    {message.success && <p role="status" className={styles.success}>{message.success}</p>}
  </div>;
}
