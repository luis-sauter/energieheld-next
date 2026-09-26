"use client";
import { useActionState } from "react";
import { saveQualityReview } from "@/app/(energieheld)/admin/quality-actions";
import type { QualityRequest } from "@/lib/company-quality-request";
import type { CompanyVerification } from "@/types/portal";
import styles from "./quality.module.css";
export function QualityReviewForm({
  profileId,
  review,
  request,
}: {
  profileId: string;
  review?: CompanyVerification | null;
  request?: QualityRequest;
}) {
  const [state, action, pending] = useActionState(saveQualityReview, {});
  return (
    <section className={styles.admin}>
      <h2>Persönliche Verifizierung</h2>
      <p>
        Unabhängig von der Profilfreischaltung dokumentiert dieses Siegel
        eine bestehende persönliche Prüfung.
      </p>
      {review?.status === "verified" ? (
        <>
          <p className={styles.verified}>✓ Persönlich verifiziert</p>
          <p>
            Verifiziert am{" "}
            <time dateTime={review.verified_at}>
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeZone: "Europe/Berlin",
              }).format(new Date(review.verified_at))}
            </time>
          </p>
        </>
      ) : request?.status === "pending" ? (
        <p>
          <strong>
            Verifizierung angefragt am{" "}
            <time dateTime={request.requested_at}>
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "medium",
                timeZone: "Europe/Berlin",
              }).format(new Date(request.requested_at))}
            </time>
          </strong>
        </p>
      ) : (
        <p>
          {request?.status === "rejected"
            ? "Verifizierungsanfrage abgelehnt."
            : "Keine Verifizierung angefragt."}
        </p>
      )}
      {(review || request?.status === "pending") && (
        <form action={action}>
          <input type="hidden" name="profile_id" value={profileId} />
          <label>
            Öffentliche Notiz (optional)
            <textarea
              name="public_note"
              maxLength={1000}
              rows={3}
              defaultValue={review?.public_note ?? ""}
              disabled={pending}
            />
          </label>
          <div className={styles.actions}>
            <button
              className="button"
              name="intent"
              value="verify"
              disabled={pending}
            >
              {review
                ? "Verifizierung aktualisieren"
                : "Persönlich verifizieren"}
            </button>
            {!review && request?.status === "pending" && (
              <button
                className="button"
                name="intent"
                value="reject"
                disabled={pending}
              >
                Anfrage ablehnen
              </button>
            )}
            {review && (
              <button
                className="button"
                name="intent"
                value="remove"
                disabled={pending}
              >
                Verifizierung entfernen
              </button>
            )}
          </div>
          {pending && <p role="status">Wird gespeichert …</p>}
        </form>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
    </section>
  );
}
