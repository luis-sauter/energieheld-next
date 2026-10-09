import 'server-only';
import { readFile } from 'node:fs/promises';
import projectAssets from '../data/media-library-project-assets.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkAdmin, isProfileId } from './admin-review';
import { validateMediaFile, MEDIA_BUCKET, MEDIA_MAX_BYTES, type MediaState } from './company-media';
import { VIDEO_BUCKET, VIDEO_MAX_BYTES, videoExtension, isProfileVideoPath, validateVideoFile } from './profile-video';
import { changeAdminCompanyMedia } from './admin-company-media';
import { changeAdminBlockImages } from './admin-block-images';
import { canReuseMediaPath, mediaTargetPrefix, type MediaLibraryTarget, type MediaAsset, type MediaLibraryPage } from './media-library';
const failure = 'Die Mediathek ist gerade nicht verfügbar. Bitte versuchen Sie es erneut.';
export async function mediaLibraryPage(client: SupabaseClient, profileId: string | null, kind: string, query: string, page: number, archived = false): Promise<MediaLibraryPage> {
    if (await checkAdmin(client) !== 'admin')
        return { items: [], count: 0, error: 'Keine Berechtigung.' };
    if (profileId !== null && !isProfileId(profileId))
        return { items: [], count: 0, error: 'Ungültiges Unternehmen.' };
    const { data, error } = await client.rpc('media_library_page', { p_profile: profileId, p_kind: kind, p_query: query.trim().slice(0, 200), p_page: page, p_archived: archived });
    if (error || !data || !Array.isArray(data.items))
        return { items: [], count: 0, error: failure };
    const items = data.items as MediaAsset[];
    // Batch signing: never create permanent public URLs, never sign noncatalog paths supplied by a client.
    const urls = new Map<string, string>();
    for (const bucket of ['company-media', 'ad-media', VIDEO_BUCKET] as const) {
        const paths = items.filter(a => (a.preview_file?.bucket ?? a.bucket_id) === bucket).map(a => a.preview_file?.path ?? a.storage_path);
        if (!paths.length)
            continue;
        const signed = await client.storage.from(bucket).createSignedUrls(paths, 600);
        if (signed.error)
            return { items: [], count: 0, error: failure };
        for (const value of signed.data ?? [])
            if (value.path && value.signedUrl)
                urls.set(bucket + ':' + value.path, value.signedUrl);
    }
    return { count: data.count, items: items.map(a => ({ ...a, src: a.bucket_id === 'external-video' ? a.storage_path : a.bucket_id === 'project-media' && projectAssets.some(p => p.path === a.storage_path) ? a.storage_path : urls.get((a.preview_file?.bucket ?? a.bucket_id) + ':' + (a.preview_file?.path ?? a.storage_path)) ?? '' })) };
}
export async function mediaLibraryUpload(client: SupabaseClient, profileId: string, form: FormData): Promise<MediaState> {
    if (await checkAdmin(client) !== 'admin' || !isProfileId(profileId))
        return { error: 'Keine Berechtigung.' };
    const profile = await client.from('company_profiles').select('id').eq('id', profileId).maybeSingle();
    if (profile.error || !profile.data)
        return { error: 'Unternehmen nicht gefunden.' };
    if (form.get('intent') === 'prepare-video') {
        const extension = videoExtension(form.get('file_type')), size = Number(form.get('file_size'));
        return extension && Number.isSafeInteger(size) && size > 0 && size <= VIDEO_MAX_BYTES
            ? { uploadPath: `profiles/${profileId}/video/${crypto.randomUUID()}.${extension}` }
            : { error: 'Bitte wählen Sie MP4 oder WebM mit maximal 50 MB.' };
    }
    if (form.get('intent') === 'video-upload') {
        const path = form.get('uploaded_path');
        if (!isProfileVideoPath(profileId, path)) return { error: 'Ungültige Videozuordnung.' };
        const stored = await client.storage.from(VIDEO_BUCKET).download(path);
        if (stored.error || !stored.data) return { error: failure };
        const file = new File([stored.data], 'video', { type: stored.data.type });
        const valid = await validateVideoFile(file);
        if (valid.error || !path.endsWith('.' + valid.extension)) return { error: valid.error ?? 'Dateiformat stimmt nicht überein.' };
        const hash = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
        const duplicate = await client.from('media_library_assets').select('id').eq('profile_id', profileId).eq('sha256', hash).is('deleted_at', null).limit(1).maybeSingle();
        if (duplicate.error) return { error: failure };
        if (duplicate.data) { await client.storage.from(VIDEO_BUCKET).remove([path]); return { success: 'Dieses Video ist bereits im Katalog vorhanden (gegebenenfalls im Archiv).' }; }
        const name = String(form.get('file_name') ?? 'Unternehmensvideo').trim().slice(0, 200) || 'Unternehmensvideo';
        const saved = await client.rpc('media_library_register_video', { p_profile: profileId, p_path: path, p_name: name, p_hash: hash });
        return saved.error ? { error: failure } : { success: 'Video ist in der Mediathek verfügbar.' };
    }
    const extension = form.get('file_type') === 'image/jpeg' ? 'jpg' : form.get('file_type') === 'image/png' ? 'png' : form.get('file_type') === 'image/webp' ? 'webp' : null;
    if (form.get('intent') === 'prepare-library') {
        const size = Number(form.get('file_size'));
        if (!extension || !Number.isSafeInteger(size) || size <= 0 || size > MEDIA_MAX_BYTES)
            return { error: 'Bitte wählen Sie JPG, PNG oder WebP mit maximal 5 MB.' };
        return { uploadPath: `profiles/${profileId}/gallery/${crypto.randomUUID()}.${extension}` };
    }
    if (form.get('intent') !== 'library-upload')
        return { error: 'Ungültige Bildaktion.' };
    const path = String(form.get('uploaded_path') ?? '');
    if (!canReuseMediaPath({ bucket_id: MEDIA_BUCKET, storage_path: path }, { profileId, kind: 'gallery' }))
        return { error: 'Der Upload gehört nicht zu diesem Unternehmen.' };
    const stored = await client.storage.from(MEDIA_BUCKET).download(path);
    if (stored.error || !stored.data)
        return { error: failure };
    const file = new File([stored.data], 'upload', { type: stored.data.type });
    const valid = await validateMediaFile(file);
    if (valid.error || !path.endsWith('.' + valid.extension))
        return { error: valid.error ?? 'Dateiformat und Upload stimmen nicht überein.' };
    const hash = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
    const duplicate = await client.from('media_library_assets').select('id,storage_path').eq('profile_id', profileId).eq('sha256', hash).is('archived_at', null).is('deletion_requested_at', null).limit(1).maybeSingle();
    if (duplicate.error)
        return { error: failure };
    if (duplicate.data && duplicate.data.storage_path !== path) {
        await client.storage.from(MEDIA_BUCKET).remove([path]);
        return { success: 'Dieses Bild ist bereits in der Mediathek vorhanden.' };
    }
    const name = String(form.get('file_name') ?? 'Unternehmensbild').trim().slice(0, 200) || 'Unternehmensbild';
    const imageKind = String(form.get('media_kind') ?? 'gallery');
    if (!['gallery','logo','contact','block','banner'].includes(imageKind)) return { error: 'Ungültige Bildart.' };
    const saved = imageKind === 'gallery' ? await client.rpc('media_library_register_upload', { p_profile: profileId, p_path: path, p_name: name, p_hash: hash }) : await client.rpc('media_library_register_image', { p_profile:profileId,p_path:path,p_name:name,p_hash:hash,p_kind:imageKind });
    return saved.error ? { error: failure } : { success: 'Bild ist in der Mediathek verfügbar.' };
}
export async function attachMediaLibraryAsset(client: SupabaseClient, assetId: string, target: MediaLibraryTarget): Promise<MediaState> {
    if (await checkAdmin(client) !== 'admin' || !isProfileId(assetId) || !isProfileId(target.profileId) || !['gallery', 'logo', 'contact', 'block', 'video', 'video_block'].includes(target.kind) || target.kind === 'block' && !isProfileId(target.blockId))
        return { error: 'Keine Berechtigung oder ungültiges Bildziel.' };
    const loaded = await client.from('media_library_assets').select('*').eq('id', assetId).is('archived_at', null).is('deletion_requested_at', null).maybeSingle();
    if (loaded.error || !loaded.data)
        return { error: 'Das Bild ist nicht mehr verfügbar.' };
    const asset = loaded.data as MediaAsset;
    if (target.kind === 'video' || target.kind === 'video_block') {
        if (asset.kind !== 'video' || asset.profile_id !== target.profileId || target.kind === 'video_block' && !isProfileId(target.blockId)) return { error: 'Bitte wählen Sie ein Video dieses Unternehmens.' };
        const applied = await client.rpc('media_library_use_video', { p_profile: target.profileId, p_asset: asset.id, p_block: target.kind === 'video_block' ? target.blockId : null });
        return applied.error ? { error: failure } : { success: 'Video eingesetzt. Das Original bleibt erhalten.' };
    }
    if (asset.kind === 'video') return { error: 'Ein Video kann nicht als Bild eingesetzt werden.' };

    const profile = await client.from('company_profiles').select('id,slug,logo_path,contact_image_path,company_profile_images(id,storage_path)').eq('id', target.profileId).maybeSingle();
    if (profile.error || !profile.data)
        return { error: 'Unternehmen nicht gefunden.' };
    // Validate replacement/capacity before making a controlled copy. Database guards handle concurrent writes.
    if (target.kind === 'gallery') {
        const rows = profile.data.company_profile_images;
        if (target.replacementId && !rows.some(r => r.id === target.replacementId))
            return { error: 'Das Bild gehört nicht zu diesem Profil.' };
        if (!target.replacementId && rows.length >= 8)
            return { error: 'Es sind maximal 8 Bilder möglich.' };
    }
    if (target.kind === 'block') {
        const block = await client.from('profile_content_blocks').select('id,type,config,profile_content_block_images(id)').eq('id', target.blockId!).eq('profile_id', target.profileId).is('slot', null).maybeSingle();
        if (block.error || block.data?.type !== 'image_grid')
            return { error: 'Der Bildblock gehört nicht zu diesem Profil.' };
        const images = block.data.profile_content_block_images;
        if (target.replacementId ? !images.some(r => r.id === target.replacementId) : images.length >= Math.min(4, Number(block.data.config?.columns)))
            return { error: 'Für dieses Layout ist kein weiterer Bildplatz frei.' };
    }
    let path = asset.storage_path;
    const context = target.profileId + ':' + target.kind + (target.blockId ? ':' + target.blockId : '');
    if (!canReuseMediaPath(asset, target)) {
        const cached = await client.from('media_library_files').select('storage_path').eq('asset_id', asset.id).eq('context_key', context).maybeSingle();
        if (cached.error)
            return { error: failure };
        if (cached.data)
            path = cached.data.storage_path;
        else {
            let original = asset.bucket_id === 'project-media' ? await readProjectOriginal(asset.storage_path) : await client.storage.from(asset.bucket_id).download(asset.storage_path);
            if (original.error && asset.bucket_id === 'ad-media') {
                const copy = await client.from('media_library_files').select('storage_path').eq('asset_id', asset.id).eq('bucket_id', 'company-media').limit(1).maybeSingle();
                if (copy.data)
                    original = await client.storage.from(MEDIA_BUCKET).download(copy.data.storage_path);
            }
            if (original.error || !original.data)
                return { error: failure };
            const valid = await validateMediaFile(new File([original.data], asset.name, { type: original.data.type }));
            if (valid.error || !valid.file)
                return { error: valid.error ?? failure };
            path = mediaTargetPrefix(target) + crypto.randomUUID() + '.' + valid.extension;
            const copied = await client.storage.from(MEDIA_BUCKET).upload(path, valid.file, { contentType: valid.file.type, upsert: false });
            if (copied.error)
                return { error: failure };
            const registered = await client.from('media_library_files').insert({ bucket_id: MEDIA_BUCKET, storage_path: path, profile_id: target.profileId, asset_id: asset.id, context_key: context });
            if (registered.error) {
                await client.storage.from(MEDIA_BUCKET).remove([path]);
                return { error: 'Die Bildauswahl hat sich geändert. Bitte wählen Sie das Bild erneut.' };
            }
        }
    }
    const form = new FormData();
    form.set('uploaded_path', path);
    form.set('alt_text', asset.alt_text);
    if (target.replacementId)
        form.set('image_id', target.replacementId);
    if (target.kind === 'block') {
        form.set('block_id', target.blockId!);
        form.set('intent', 'upload');
        return changeAdminBlockImages(client, target.profileId, profile.data.slug, form);
    }
    if (target.kind === 'contact' && profile.data.contact_image_path === path || target.kind === 'logo' && profile.data.logo_path === path)
        return { success: 'Dieses Bild wird bereits verwendet.' };
    if (target.kind === 'gallery' && !target.replacementId && profile.data.company_profile_images.some(r => r.storage_path === path))
        return { error: 'Dieses Bild ist bereits in der Galerie.' };
    form.set('intent', target.kind + '-upload');
    return changeAdminCompanyMedia(client, target.profileId, form);
}
async function readProjectOriginal(path: string): Promise<{
    data: Blob | null;
    error: unknown;
}> {
    const known = projectAssets.find(a => a.path === path);
    if (!known)
        return { data: null, error: true };
    const type = path.endsWith('.jpg') ? 'image/jpeg' : path.endsWith('.png') ? 'image/png' : 'image/webp';
    try {
        let bytes: Buffer;
        try {
            bytes = await readFile(process.cwd() + '/public' + path);
        }
        catch {
            // Production static assets are served by Netlify, not necessarily bundled in a function.
            // Only deployment configuration determines this first-party origin; no request Host or submitted URL.
            const origin = process.env.DEPLOY_URL || process.env.URL;
            if (!origin)
                throw Error('Project original unavailable');
            const url = new URL(path, origin);
            if (!/^https:$/.test(url.protocol) || !url.hostname.endsWith('.netlify.app'))
                throw Error('Invalid origin');
            const response = await fetch(url, { redirect: 'error' });
            if (!response.ok)
                throw Error('Project original unavailable');
            if (Number(response.headers.get('content-length')) > MEDIA_MAX_BYTES)
                throw Error('Image too large');
            const reader = response.body?.getReader();
            if (!reader)
                throw Error('Image unavailable');
            const chunks: Uint8Array[] = [];
            let length = 0;
            for (;;) {
                const part = await reader.read();
                if (part.done)
                    break;
                length += part.value.length;
                if (length > MEDIA_MAX_BYTES) {
                    await reader.cancel();
                    throw Error('Image too large');
                }
                chunks.push(part.value);
            }
            bytes = Buffer.concat(chunks);
        }
        if (createHash('sha256').update(bytes).digest('hex') !== known.hash)
            return { data: null, error: true };
        return { data: new Blob([new Uint8Array(bytes)], { type }), error: null };
    }
    catch {
        return { data: null, error: true };
    }
}
