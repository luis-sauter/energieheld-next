"use client";
import { useActionState } from 'react';
import { saveProfileVisibility } from '@/app/(energieheld)/admin/firmen/visibility-actions';
export function ProfilePublicVisibility({profileId,listed}: {profileId:string;listed:boolean}) {
  const [state,action,busy] = useActionState(saveProfileVisibility, {});
  return <section aria-labelledby="visibility-title"><h2 id="visibility-title">Öffentliche Sichtbarkeit</h2>
    <p>Ausblenden entfernt das Profil aus öffentlichen Listen, der Suche, der Sitemap und der öffentlichen Profilseite. Freigabestatus, interne Bearbeitung und verknüpfte Banner bleiben erhalten.</p>
    <form action={action}><input type="hidden" name="profile_id" value={profileId}/><label>Profil anzeigen<select name="is_listed" defaultValue={listed?'yes':'no'} disabled={busy}><option value="yes">Öffentlich sichtbar</option><option value="no">Aus öffentlichen Unterkunftsansichten ausblenden</option></select></label><button className="button" disabled={busy}>Sichtbarkeit speichern</button></form>
    {state.error && <p role="alert">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
  </section>;
}
