import type { SupabaseClient } from '@supabase/supabase-js';
import { checkAdmin, isProfileId } from './admin-review';
import { AD_BUCKET } from './ad-campaigns';
import { validateMediaFile } from './company-media';

export type LifecycleState = { error?: string; success?: string; redirectTo?: string };
export async function changeAdLifecycle(client: SupabaseClient, form: FormData): Promise<LifecycleState> {
  if (await checkAdmin(client) !== 'admin') return { error: 'Keine Berechtigung.' };
  const id = form.get('campaign_id'), action = form.get('action');
  if (!isProfileId(id) || !['archive', 'reuse', 'delete'].includes(String(action)) || form.get('confirmed') !== 'yes')
    return { error: 'Bitte bestätigen Sie die gewünschte Aktion.' };
  const { data: original, error } = await client.from('company_ad_campaigns').select('*').eq('id', id).maybeSingle();
  if (error || !original) return { error: 'Die Kampagne konnte nicht geladen werden.' };
  const rpc = (campaignId: string, operation: string, path?: string) => client.rpc('admin_ad_lifecycle', {
    p_id: campaignId, p_action: operation, ...(path ? { p_image_path: path } : {}),
  });
  try {
    if (action === 'archive') {
      const result = await rpc(id, 'archive');
      return result.error ? { error: 'Archivieren fehlgeschlagen. Bitte versuchen Sie es erneut.' } : { success: 'Kampagne archiviert. Sie wird nicht mehr öffentlich ausgeliefert.' };
    }
    if (!original.archived_at) return { error: 'Bitte archivieren Sie die Kampagne zuerst.' };
    if (action === 'reuse') {
      const created = await rpc(id, 'reuse');
      if (created.error || !isProfileId(created.data)) return { error: 'Der neue Entwurf konnte nicht erstellt werden.' };
      const destination = `/admin/werbung/${created.data}`;
      if (original.image_path) {
        let uploadPath: string | undefined;
        try {
          if (!String(original.image_path).startsWith(`campaigns/${id}/creative/`)) throw Error('Invalid media');
          const media = client.storage.from(AD_BUCKET);
          const downloaded = await media.download(original.image_path);
          if (downloaded.error || !downloaded.data) throw Error('Download failed');
          const extension = String(original.image_path).split('.').pop();
          const mime = extension === 'jpg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : 'image/webp';
          const checked = await validateMediaFile(new File([downloaded.data], `creative.${extension}`, { type: mime }));
          if (checked.error) throw Error('Invalid creative');
          uploadPath = `campaigns/${created.data}/creative/${crypto.randomUUID()}.${extension}`;
          const uploaded = await media.upload(uploadPath, downloaded.data, { contentType: mime, upsert: false });
          if (uploaded.error) throw Error('Upload failed');
          const attached = await rpc(created.data, 'attach_copy', uploadPath);
          if (attached.error) throw Error('Attach failed');
        } catch {
          if (uploadPath) await client.storage.from(AD_BUCKET).remove([uploadPath]);
          return { error: 'Der Entwurf wurde erstellt, das Bild konnte jedoch nicht kopiert werden. Öffnen Sie den Entwurf und fügen Sie das Bild erneut hinzu.', redirectTo: destination };
        }
      }
      return { success: 'Neuer Entwurf erstellt. Bitte wählen Sie Zielseite, Bannerplatz und Zeitraum neu.', redirectTo: destination };
    }
    const prepared = await rpc(id, 'prepare_delete');
    if (prepared.error) return { error: 'Löschen konnte nicht vorbereitet werden.' };
    // Include superseded/unreferenced uploads, while the campaign still exists for Storage RLS.
    const media = client.storage.from(AD_BUCKET), folder = `campaigns/${id}/creative`;
    let previousFirst: string | undefined;
    for (;;) {
      const files = await media.list(folder, { limit: 100, offset: 0 });
      if (files.error) return { error: 'Medienbereinigung fehlgeschlagen. Die archivierte Kampagne bleibt erhalten; bitte erneut versuchen.' };
      if (!files.data?.length) break;
      if (previousFirst === files.data[0].name) return { error: 'Die Medienbereinigung wurde nicht bestätigt. Bitte versuchen Sie es erneut.' };
      previousFirst = files.data[0].name;
      const removed = await media.remove(files.data.map(file => `${folder}/${file.name}`));
      if (removed.error || !removed.data?.length) return { error: 'Bilder konnten nicht entfernt werden. Die archivierte Kampagne bleibt erhalten; bitte erneut versuchen.' };
    }
    const deleted = await rpc(id, 'delete');
    return deleted.error ? { error: 'Die Kampagne bleibt archiviert. Bitte versuchen Sie das Löschen erneut.' } : { success: 'Kampagne dauerhaft gelöscht.', redirectTo: '/admin/werbung' };
  } catch {
    return { error: 'Die Aktion konnte gerade nicht abgeschlossen werden. Bitte laden Sie die Seite neu.' };
  }
}
