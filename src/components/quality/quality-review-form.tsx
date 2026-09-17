"use client";
import { useActionState } from "react";
import { saveQualityReview } from "@/app/(energieheld)/admin/quality-actions";
import type { CompanyVerification } from "@/types/portal";
import styles from "./quality.module.css";
export function QualityReviewForm({
  profileId,
  review,
}: {
  profileId: string;
  review?: CompanyVerification | null;
}) {
  const [state, action, pending] = useActionState(saveQualityReview, {});
  return (
    <section className={styles.admin}>
      <h2>Persönliche Verifizierung</h2>
      <p>
        Unabhängig von Profilfreischaltung und Gewerken. Dieses Siegel
        dokumentiert die persönliche Erfahrung des Energieheld-Teams.
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
      ) : (
        <p>Noch nicht persönlich verifiziert.</p>
      )}
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
              : "Als persönlich verifiziert markieren"}
          </button>
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
        {state.error && <p role="alert">{state.error}</p>}
        {state.success && <p role="status">{state.success}</p>}
      </form>
    </section>
  );
}
