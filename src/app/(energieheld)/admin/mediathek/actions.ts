"use server";
import { createClient } from '@/lib/supabase/server';
import { checkAdmin, isProfileId } from '@/lib/admin-review';
import { mediaLibraryPage, mediaLibraryUpload, attachMediaLibraryAsset } from '@/lib/media-library-server';
import type { MediaLibraryTarget } from '@/lib/media-library';
import type { MediaState } from '@/lib/company-media';
export async function libraryProfiles(profileId?: string) {
    const client = await createClient();
    if (await checkAdmin(client) !== 'admin')
        return { items: [], error: 'Keine Berechtigung.' };
    const synced = await client.rpc('media_library_sync');
    if (synced.error)
        return { items: [], error: 'Die Mediathek konnte nicht aktualisiert werden.' };
    const rows = await client.from('company_profiles').select('id,display_name').order('display_name').limit(500);
    if (rows.error)
        return { items: [], error: 'Unternehmen konnten nicht geladen werden.' };
    if (profileId && !rows.data.some(p => p.id === profileId) && isProfileId(profileId)) {
        const current = await client.from('company_profiles').select('id,display_name').eq('id', profileId).maybeSingle();
        if (current.data)
            rows.data.unshift(current.data);
    }
    return { items: rows.data as {
            id: string;
            display_name: string;
        }[] };
}
export async function loadLibrary(profileId: string | null, kind: string, query: string, page: number, archived: boolean) {
    return mediaLibraryPage(await createClient(), profileId, kind, query, page, archived);
}
export async function uploadLibrary(profileId: string, form: FormData): Promise<MediaState> {
    return mediaLibraryUpload(await createClient(), profileId, form);
}
export async function applyLibraryAsset(id: string, target: MediaLibraryTarget, rights: boolean): Promise<MediaState> {
    return attachMediaLibraryAsset(await createClient(), id, target, rights);
}
export async function updateLibraryAsset(id: string, form: FormData): Promise<MediaState> {
    const client = await createClient();
    if (await checkAdmin(client) !== 'admin' || !isProfileId(id))
        return { error: 'Keine Berechtigung.' };
    const fields: Record<string, string> = {};
    for (const [key, max] of [['name', 200], ['description', 2000], ['alt_text', 500], ['source', 1000], ['rights', 1000]] as const) {
        const v = form.get(key);
        if (typeof v !== 'string' || v.trim().length > max || key === 'name' && !v.trim())
            return { error: 'Bitte prüfen Sie Name und Bilddetails.' };
        fields[key] = v.trim();
    }
    const result = await client.from('media_library_assets').update(fields).eq('id', id).is('deletion_requested_at', null).select('id').maybeSingle();
    return result.error || !result.data ? { error: 'Bilddetails konnten nicht gespeichert werden.' } : { success: 'Bilddetails gespeichert. Bestehende Verwendungs-Alt-Texte bleiben erhalten.' };
}
export async function archiveLibraryAsset(id: string, archived: boolean): Promise<MediaState> {
    const client = await createClient();
    if (await checkAdmin(client) !== 'admin' || !isProfileId(id))
        return { error: 'Keine Berechtigung.' };
    const result = await client.from('media_library_assets').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', id).is('deletion_requested_at', null).select('id').maybeSingle();
    return result.error || !result.data ? { error: 'Das Bild konnte nicht archiviert werden.' } : { success: archived ? 'Bild archiviert. Vorhandene Verwendungen bleiben erhalten.' : 'Bild wieder verfügbar.' };
}
export async function deleteLibraryAsset(id: string): Promise<MediaState> {
    const client = await createClient();
    if (await checkAdmin(client) !== 'admin' || !isProfileId(id))
        return { error: 'Keine Berechtigung.' };
    const locked = await client.rpc('media_library_request_delete', { p_asset: id });
    if (locked.error || !Array.isArray(locked.data))
        return { error: 'Nur archivierte Bilder ohne Verwendungen können endgültig gelöscht werden.' };
    for (const bucket of ['company-media', 'ad-media']) {
        const paths = locked.data.filter((f: {
            bucket: string;
            path: string;
        }) => f.bucket === bucket).map((f: {
            path: string;
        }) => f.path);
        if (!paths.length)
            continue;
        const result = await client.storage.from(bucket).remove(paths);
        if (result.error)
            return { error: 'Das Original bleibt für neue Verwendungen gesperrt. Die Löschung konnte nicht abgeschlossen werden; bitte erneut versuchen.' };
        // Storage can return an empty DELETE result. Verify the object is really absent.
        for (const path of paths) {
            const directory = path.slice(0, path.lastIndexOf('/')), name = path.slice(path.lastIndexOf('/') + 1);
            const listed = await client.storage.from(bucket).list(directory, { search: name, limit: 100 });
            if (listed.error || listed.data.some(f => f.name === name))
                return { error: 'Die Dateilöschung konnte nicht bestätigt werden. Bitte erneut versuchen.' };
        }
    }
    const finished = await client.rpc('media_library_finish_delete', { p_asset: id });
    return finished.error ? { error: 'Die Dateilöschung konnte nicht abgeschlossen werden. Bitte erneut versuchen.' } : { success: 'Original und kontrollierte Kopien endgültig gelöscht.' };
}
