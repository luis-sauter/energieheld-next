"use server";
import { createClient } from '@/lib/supabase/server';
import { checkAdmin, isProfileId } from '@/lib/admin-review';
import { mediaLibraryPage, mediaLibraryUpload, attachMediaLibraryAsset } from '@/lib/media-library-server';
import { companySearchPattern, recordMediaPermission, MEDIA_PERMISSION_KINDS, type MediaLibraryTarget } from '@/lib/media-library';
import type { MediaState } from '@/lib/company-media';
export async function libraryProfiles(profileId?: string) {
    const client = await createClient();
    if (await checkAdmin(client) !== 'admin')
        return { items: [], error: 'Keine Berechtigung.' };
    const synced = await client.rpc('media_library_sync');
    if (synced.error)
        return { items: [], error: 'Die Mediathek konnte nicht aktualisiert werden.' };
    const current = profileId && isProfileId(profileId) ? await client.from('company_profiles').select('id,display_name').eq('id', profileId).maybeSingle() : null;
    return { items: current?.data ? [current.data] : [], error: current?.error ? 'Unternehmen konnte nicht geladen werden.' : undefined };
}
export async function searchLibraryProfiles(query = '', page = 1) {
    const client = await createClient();
    if (await checkAdmin(client) !== 'admin') return { items: [], more: false, error: 'Keine Berechtigung.' };
    const offset = (Math.max(1, Math.min(10000, Math.floor(page) || 1)) - 1) * 30;
    let request = client.from('company_profiles').select('id,display_name').order('display_name').order('id');
    if (query.trim()) request = request.filter('display_name', 'imatch', companySearchPattern(query));
    const rows = await request.range(offset, offset + 30);
    return { items: (rows.data ?? []).slice(0, 30), more: (rows.data?.length ?? 0) > 30, error: rows.error ? 'Unternehmen konnten nicht geladen werden.' : undefined };
}

export async function loadLibrary(profileId: string | null, kind: string, query: string, page: number, archived: boolean) {
    return mediaLibraryPage(await createClient(), profileId, kind, query, page, archived);
}
export async function uploadLibrary(profileId: string, form: FormData): Promise<MediaState> {
    return mediaLibraryUpload(await createClient(), profileId, form);
}
export async function applyLibraryAsset(id: string, target: MediaLibraryTarget): Promise<MediaState> {
    return attachMediaLibraryAsset(await createClient(), id, target);
}
export async function updateLibraryAsset(id: string, form: FormData): Promise<MediaState & { rights?: string }> {
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
    const loaded = await client.from('media_library_assets').select('rights').eq('id', id).is('deletion_requested_at', null).maybeSingle();
    if (loaded.error || !loaded.data) return { error: 'Bilddetails konnten nicht geladen werden.' };
    const destination = String(form.get('permission_profile') ?? '');
    const evidence = String(form.get('permission_evidence') ?? '').trim();
    const scope = String(form.get('permission_scope') ?? 'all');
    const requested = scope.split(',');
    if (scope !== 'all' && !requested.every(value => MEDIA_PERMISSION_KINDS.some(k => k === value))) return { error: 'Ungültiger Nutzungsumfang.' };
    const kinds = scope === 'all' ? MEDIA_PERMISSION_KINDS : MEDIA_PERMISSION_KINDS.filter(k => requested.includes(k));
    if (destination) {
        if (!isProfileId(destination) || evidence.length > 500) return { error: 'Bitte prüfen Sie die Nutzungserlaubnis.' };
        const profile = await client.from('company_profiles').select('id').eq('id', destination).maybeSingle();
        if (profile.error || !profile.data) return { error: 'Zielunternehmen nicht gefunden.' };
    }
    fields.rights = recordMediaPermission(loaded.data.rights, fields.rights, destination, evidence, kinds);
    if (fields.rights.length > 1000) return { error: 'Lizenzangaben und Nutzungserlaubnisse dürfen zusammen maximal 1000 Zeichen enthalten.' };
    const result = await client.from('media_library_assets').update(fields).eq('id', id).is('deletion_requested_at', null).select('id').maybeSingle();
    return result.error || !result.data ? { error: 'Bilddetails konnten nicht gespeichert werden.' } : { success: 'Bilddetails gespeichert. Bestehende Verwendungs-Alt-Texte bleiben erhalten.', rights: fields.rights };
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
