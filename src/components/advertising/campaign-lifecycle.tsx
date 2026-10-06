'use client';
import { useActionState, useState, type ReactNode } from 'react';
import { lifecycleCampaign } from '@/app/(energieheld)/admin/werbung/actions';
import styles from './advertising.module.css';

export function CampaignLifecycle({ id, archived, disabled = false, children, onArchived, onBusyChange, onArchive }: {
  id: string; archived: boolean; disabled?: boolean; children?: ReactNode;
  onArchived?: (message: string) => void; onBusyChange?: (busy: boolean) => void;
  onArchive?: (form: FormData) => Promise<{ error?: string; success?: string; redirectTo?: string }>;
}) {
  const [intent, setIntent] = useState<'reuse' | 'delete' | null>(null);
  const [state, action, pending] = useActionState(async (_previous: { error?: string; success?: string; redirectTo?: string }, form: FormData) => {
    if (form.get('action') === 'archive') form.set('confirmed', 'yes');
    onBusyChange?.(true);
    try {
      const result = onArchive && form.get('action') === 'archive' ? await onArchive(form) : await lifecycleCampaign({}, form);
      if (result.success && form.get('action') === 'archive') onArchived?.(result.success);
      return result;
    } finally { onBusyChange?.(false); }
  }, {});
  const busy = pending || disabled;
  return <form action={action} aria-label="Banneraktionen">
    <input type="hidden" name="campaign_id" value={id} />
    <div className={styles.actions}>
      {archived ? <>
        <button type="button" className="button" disabled={busy} onClick={() => setIntent('reuse')}>Banner wiederverwenden</button>
        <button type="button" className="button" disabled={busy} onClick={() => setIntent('delete')}>Dauerhaft löschen</button>
      </> : <button type="submit" name="action" value="archive" className="button" disabled={busy} formNoValidate>Banner archivieren</button>}
      {children}
    </div>
    {intent && <>
      <p>{intent === 'reuse' ? 'Ein unabhängiger Entwurf entsteht. Seite, Bannerplatz und Zeitraum müssen neu gewählt werden.' : 'Dauerhaftes Löschen entfernt dieses Banner und seine Bilder unwiderruflich.'}</p>
      <input type="hidden" name="action" value={intent} />
      <label><input key={intent} type="checkbox" name="confirmed" value="yes" required disabled={busy} /> Aktion bestätigen</label>
      <div className={styles.actions}>
        <button type="submit" className="button" disabled={busy}>{intent === 'reuse' ? 'Ja, Banner wiederverwenden' : 'Ja, dauerhaft löschen'}</button>
        <button type="button" className="button" disabled={busy} onClick={() => setIntent(null)}>Abbrechen</button>
      </div>
    </>}
    {pending && <p role="status">Aktion wird ausgeführt …</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {state.success && <p role="status">{state.success}</p>}
    {state.redirectTo && <a className="button" href={state.redirectTo}>Entwurf öffnen</a>}
  </form>;
}
