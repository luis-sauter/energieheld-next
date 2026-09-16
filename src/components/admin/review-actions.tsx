"use client";

import { useState, useTransition } from "react";
import {
  approveProfile,
  rejectProfile,
} from "@/app/(energieheld)/admin/actions";
import { canReviewProfile } from "@/lib/admin-review-state";
import styles from "./admin.module.css";

export function ReviewActions({
  profileId,
  status,
}: {
  profileId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const disabled =
    pending || !canReviewProfile(status) || Boolean(message.success);
  function run(action: typeof approveProfile) {
    setMessage({});
    startTransition(async () => {
      try {
        setMessage(await action(profileId));
      } catch {
        setMessage({
          error:
            "Die Prüfung konnte nicht abgeschlossen werden. Bitte laden Sie die Seite neu.",
        });
      }
    });
  }
  return (
    <section aria-label="Profilentscheidung" aria-busy={pending}>
      {!canReviewProfile(status) && (
        <p>
          Dieses Profil wartet nicht auf Prüfung. Es kann hier nicht erneut
          geprüft werden.
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className="button button-primary"
          disabled={disabled}
          onClick={() => run(approveProfile)}
        >
          Profil freigeben
        </button>
        <button
          type="button"
          className="button"
          disabled={disabled}
          onClick={() => run(rejectProfile)}
        >
          Änderungen erforderlich
        </button>
      </div>
      {pending && <p role="status">Entscheidung wird gespeichert …</p>}
      {message.error && (
        <p role="alert" className={styles.error}>
          {message.error}
        </p>
      )}
      {message.success && (
        <p role="status" className={styles.success}>
          {message.success}
        </p>
      )}
    </section>
  );
}
