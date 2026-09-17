"use client";

import { useState, useTransition } from "react";
import {
  approveProfile,
  rejectProfile,
  saveCategories,
} from "@/app/(energieheld)/admin/actions";
import {
  canReviewProfile,
  reviewStatusMessage,
} from "@/lib/admin-review-state";
import { energieheld } from "@/config/energieheld";
import styles from "./admin.module.css";

export function ReviewActions({
  profileId,
  status,
  initialCategoryIds,
}: {
  profileId: string;
  status: string;
  initialCategoryIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [categoryIds, setCategoryIds] = useState(initialCategoryIds);
  const [message, setMessage] = useState<{ error?: string; success?: string }>(
    {},
  );
  const disabled =
    pending ||
    (!canReviewProfile(status) && status !== "approved") ||
    Boolean(message.success);
  function run(action: () => ReturnType<typeof rejectProfile>) {
    setMessage({});
    startTransition(async () => {
      try {
        setMessage(await action());
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
      {!canReviewProfile(status) && <p>{reviewStatusMessage(status)}</p>}
      <fieldset className={styles.categories} disabled={disabled}>
        <legend>Öffentliche Gewerke</legend>
        <p>
          Wählen Sie mindestens ein offizielles Gewerk aus. Diese Zuordnung wird
          ausschließlich durch Energieheld festgelegt.
        </p>
        {energieheld.categories.map((category) => (
          <label key={category.id}>
            <input
              type="checkbox"
              name="categoryIds"
              value={category.id}
              checked={categoryIds.includes(category.id)}
              onChange={(event) =>
                setCategoryIds((current) =>
                  event.target.checked
                    ? [...current, category.id]
                    : current.filter((id) => id !== category.id),
                )
              }
            />
            {category.name}
          </label>
        ))}
      </fieldset>
      <div className={styles.actions}>
        <button
          type="button"
          className="button button-primary"
          disabled={disabled}
          onClick={() =>
            run(() =>
              status === "approved"
                ? saveCategories(profileId, categoryIds)
                : approveProfile(profileId, categoryIds),
            )
          }
        >
          {status === "approved"
            ? "Gewerke speichern"
            : "Firma erstmalig freischalten"}
        </button>
        {status !== "approved" && (
          <button
            type="button"
            className="button"
            disabled={disabled}
            onClick={() => run(() => rejectProfile(profileId))}
          >
            Rückfrage erforderlich
          </button>
        )}
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
