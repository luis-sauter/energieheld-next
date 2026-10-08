"use client";
import { useActionState } from "react";
import { saveEditorialNote } from "@/app/(energieheld)/firma/profil/gestalten/note-actions";
import styles from "./auth.module.css";

export function EditorialNoteForm({ initialNote, error }: { initialNote?: string; error?: string }) {
  const [state, action, pending] = useActionState(saveEditorialNote, {});
  return <section className={styles.card} aria-labelledby="editorial-note-title">
    <h2 id="editorial-note-title">Hinweise an die Redaktion</h2>
    <p>Sie haben besondere Wünsche zur Darstellung Ihres Profils oder möchten unserer Redaktion etwas mitteilen? Schreiben Sie uns hier Ihre Hinweise.</p>
    <p>Nur für Sie und unsere Redaktion sichtbar.</p>
    {error ? <p role="alert">{error}</p> : <form action={action} className={styles.form} aria-busy={pending}>
      <label className={styles.field}>Ihre Hinweise (optional)
        <textarea name="owner_note" rows={6} maxLength={4000} defaultValue={initialNote ?? ""} disabled={pending}
          placeholder="Besondere Ausstattung, gewünschte Schwerpunkte oder weitere Hinweise …" />
      </label>
      <small>Maximal 4.000 Zeichen</small>
      <div><button className="button button-primary" disabled={pending}>{pending ? "Speichert …" : "Hinweise speichern"}</button></div>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      {state.success && <p role="status" className={styles.success}>{state.success}</p>}
    </form>}
  </section>;
}
