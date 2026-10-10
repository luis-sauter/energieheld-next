import { profileStatus } from './auth';
export function publicationStatus(status: string, listed = true) {
  return status === 'approved' ? listed ? 'Veröffentlicht' : 'Veröffentlichung zurückgenommen' : profileStatus(status);
}
export const importCompanyViews = [
  { key: 'neu-importiert', label: 'Neu importiert – noch zu prüfen', status: undefined, filter: 'new_imports' },
  { key: 'importe', label: 'Importierte Unternehmen', status: undefined, filter: 'imports' },
  { key: 'zurueckgenommen', label: 'Veröffentlichung zurückgenommen', status: 'approved' as const, filter: 'withdrawn' },
];
