'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { lifecycleOfferRequest } from '@/app/(energieheld)/angebot-anfragen/actions';
import styles from './advertising.module.css';

export function OfferRequestLifecycle({ id, archived, deleting }: { id: string; archived: boolean; deleting: boolean }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [state, action, pending] = useActionState(lifecycleOfferRequest, {});
  return <section className={styles.lifecycle} aria-label="Anfrage verwalten">
    <h3>Anfrage verwalten</h3>
    <p>{archived ? 'Diese Anfrage liegt im Archiv. Angaben, Gesprächsnotizen und Originalbilder bleiben dort abrufbar.' : 'Archivieren entfernt die Anfrage aus dem aktiven Bestand. Sie können sie im Archiv jederzeit wieder aufrufen und wiederherstellen.'}</p>
    {deleting && <p role="status">Die Löschung wurde begonnen. Die Anfrage bleibt bis zum vollständigen Abschluss im Archiv.</p>}
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {confirmDelete ? <>
        <input type="hidden" name="action" value="delete" />
        <p>Die Anfrage samt internen Ergänzungen, Gesprächsnotizen und hochgeladenen Originalbildern wird dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.</p>
        <label className={styles.deleteConfirmation}><input type="checkbox" name="confirmed" value="yes" required disabled={pending} /> Ich möchte diese Anfrage dauerhaft löschen.</label>
        <div className={styles.actions}>
          <button className="button" type="submit" disabled={pending}>Ja, Anfrage dauerhaft löschen</button>
          <button className="button" type="button" disabled={pending} onClick={() => setConfirmDelete(false)}>Abbrechen</button>
        </div>
      </> : <div className={styles.actions}>
        <input type="hidden" name="confirmed" value="yes" />
        <button className="button" type="submit" name="action" value={archived ? 'restore' : 'archive'} disabled={pending || deleting}>{archived ? 'Anfrage wiederherstellen' : 'Anfrage archivieren'}</button>
        <button className="button" type="button" disabled={pending} onClick={() => setConfirmDelete(true)}>Anfrage löschen</button>
        <Link href="/admin/werbung?archiv=1">Archiv öffnen</Link>
      </div>}
      {pending && <p role="status">Anfrage wird aktualisiert …</p>}
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  </section>;
}
