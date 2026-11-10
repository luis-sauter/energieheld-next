import type { SupabaseClient } from '@supabase/supabase-js';
import { checkAdmin, isProfileId } from './admin-review';
import type { LifecycleState } from './ad-lifecycle';

export async function changeOfferRequestLifecycle(client: SupabaseClient, form: FormData): Promise<LifecycleState> {
  if (await checkAdmin(client) !== 'admin') return { error: 'Keine Berechtigung.' };
  const id = form.get('id'), action = String(form.get('action'));
  if (!isProfileId(id) || !['archive', 'restore', 'delete'].includes(action) || form.get('confirmed') !== 'yes')
    return { error: 'Bitte bestätigen Sie die gewünschte Aktion.' };
  const { data: request, error } = await client.from('company_ad_campaigns').select('id,request_status,archived_at,deletion_requested_at').eq('id', id).maybeSingle();
  if (error || !request?.request_status) return { error: 'Die Angebotsanfrage konnte nicht geladen werden.' };
  const rpc = (operation: string) => client.rpc('admin_offer_request_lifecycle', { p_id: id, p_action: operation });
  try {
    if (action !== 'delete') {
      const result = await rpc(action);
      if (result.error) return { error: action === 'restore' ? 'Wiederherstellen fehlgeschlagen. Eine bereits begonnene Löschung muss zuerst abgeschlossen werden.' : 'Archivieren fehlgeschlagen. Bitte versuchen Sie es erneut.' };
      return { success: action === 'archive' ? 'Anfrage archiviert.' : 'Anfrage wiederhergestellt.', redirectTo: action === 'archive' ? '/admin/werbung?archiv=1' : `/admin/werbung/${id}` };
    }
    if (!request.archived_at && (await rpc('archive')).error) return { error: 'Die Anfrage konnte nicht zum Löschen archiviert werden.' };
    if ((await rpc('prepare_delete')).error) return { error: 'Die Löschung konnte nicht vorbereitet werden.' };
    const media = client.storage.from('ad-media'), folder = `campaigns/${id}/creative`;
    let previousFirst: string | undefined;
    for (;;) {
      const files = await media.list(folder, { limit: 100, offset: 0 });
      if (files.error) return { error: 'Die Bilder konnten nicht geladen werden. Die Anfrage bleibt im Archiv; bitte Löschung erneut versuchen.' };
      if (!files.data?.length) break;
      if (files.data[0].name === previousFirst || files.data.some(file => !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file.name)))
        return { error: 'Die Bildbereinigung wurde nicht bestätigt. Die Anfrage bleibt im Archiv.' };
      previousFirst = files.data[0].name;
      const removed = await media.remove(files.data.map(file => `${folder}/${file.name}`));
      if (removed.error || removed.data?.length !== files.data.length) return { error: 'Nicht alle Bilder konnten gelöscht werden. Die Anfrage bleibt im Archiv; bitte Löschung erneut versuchen.' };
    }
    if ((await rpc('delete')).error) return { error: 'Die Anfrage bleibt im Archiv. Bitte versuchen Sie die Löschung erneut.' };
    return { success: 'Anfrage dauerhaft gelöscht.', redirectTo: '/admin/werbung?archiv=1' };
  } catch {
    return { error: 'Die Aktion konnte nicht abgeschlossen werden. Bitte laden Sie die Seite neu.' };
  }
}
