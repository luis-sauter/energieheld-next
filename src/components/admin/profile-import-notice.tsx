import type { ProfileImport } from '@/lib/profile-import';
import styles from './admin.module.css';
export function ProfileImportNotice({ entry, status }: { entry?: ProfileImport; status: string }) {
  if (!entry) return null;
  return <section className={styles.categories} aria-label="Importherkunft">
    <strong>{status === 'draft' || status === 'pending' ? 'Neu importiert' : 'Importherkunft'}</strong>
    <p><a href={entry.source_url} target="_blank" rel="noopener noreferrer">Offizielle Quelle</a> · {new Intl.DateTimeFormat('de-DE', {timeZone:'Europe/Berlin'}).format(new Date(entry.imported_at))}</p>
    {entry.review_note && <p className={styles.reviewNote}>{entry.review_note}</p>}
  </section>;
}
