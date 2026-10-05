'use client';
import { useActionState } from 'react';
import { lifecycleCampaign } from '@/app/(energieheld)/admin/werbung/actions';
import styles from './advertising.module.css';

export function CampaignLifecycle({ id, archived }: { id: string; archived: boolean }) {
  const [state, action, pending] = useActionState(lifecycleCampaign, {});
  return <section aria-label="Kampagnenverwaltung" className={styles.card}>
    <h3>{archived ? 'Archivierte Kampagne' : 'Kampagne archivieren'}</h3>
    <p>{archived ? 'Das Original bleibt erhalten. Wiederverwenden erstellt einen unabhängigen Entwurf ohne Buchung.' : 'Archivieren beendet die öffentliche Auslieferung und erhält die Kampagne samt Buchungsdaten.'}</p>
    <form action={action}>
      <input type="hidden" name="campaign_id" value={id} />
      <label><input type="checkbox" name="confirmed" value="yes" required disabled={pending} /> {archived ? 'Aktion bestätigen. Dauerhaftes Löschen entfernt diese Kampagne und ihre Bilder unwiderruflich.' : 'Archivierung bestätigen.'}</label>
      <div className={styles.actions}>
        {archived ? <>
          <button className="button" name="action" value="reuse" disabled={pending}>Wiederverwenden</button>
          <button className="button" name="action" value="delete" disabled={pending}>Dauerhaft löschen</button>
        </> : <button className="button" name="action" value="archive" disabled={pending}>Archivieren</button>}
      </div>
      {pending && <p role="status">Aktion wird ausgeführt …</p>}
      {state.error && <p role="alert">{state.error}</p>}
      {state.success && <p role="status">{state.success}</p>}
      {state.redirectTo && <a className="button" href={state.redirectTo}>Entwurf öffnen</a>}
    </form>
  </section>;
}
