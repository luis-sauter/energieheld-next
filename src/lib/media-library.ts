import { GALLERY_LIMIT } from "./gallery-limit";
export type MediaLibraryTarget = {
    profileId: string;
    kind: 'gallery' | 'logo' | 'contact' | 'block' | 'video' | 'video_block';
    blockId?: string;
    replacementId?: string;
    capacity?: number;
};
export type MediaAsset = {
    id: string;
    profile_id: string | null;
    profile_name: string | null;
    bucket_id: 'company-media' | 'ad-media' | 'project-media' | 'company-profile-videos' | 'external-video';
    storage_path: string;
    kind: string;
    name: string;
    description: string;
    alt_text: string;
    source: string;
    rights: string;
    archived_at: string | null;
    src: string;
    mime_type?: string | null;
    byte_size?: number | null;
    preview_file?: {
        bucket: 'company-media' | 'ad-media' | 'project-media' | 'company-profile-videos' | 'external-video';
        path: string;
    };
    usages: {
        label: string;
        profileId: string | null;
        id: string;
    }[];
};
export type MediaLibraryPage = {
    items: MediaAsset[];
    count: number;
    error?: string;
};
export const MEDIA_LIBRARY_PAGE_SIZE = 24;
export function mediaTargetPrefix(target: MediaLibraryTarget) {
    return target.kind === 'block' ? `profiles/${target.profileId}/blocks/${target.blockId}/` : `profiles/${target.profileId}/${target.kind}/`;
}
export function canReuseMediaPath(asset: Pick<MediaAsset, 'bucket_id' | 'storage_path'>, target: MediaLibraryTarget) {
    const prefix = mediaTargetPrefix(target);
    return asset.bucket_id === 'company-media' && asset.storage_path.startsWith(prefix) && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(asset.storage_path.slice(prefix.length));
}
export function mediaNeedsRights(asset: Pick<MediaAsset, 'profile_id' | 'bucket_id'>, profileId: string) {
    return asset.bucket_id === 'ad-media' || asset.profile_id !== profileId;
}
export function mediaSelectionLimit(target?: MediaLibraryTarget) {
    return target?.kind === 'gallery' && !target.replacementId ? Math.max(0, Math.min(GALLERY_LIMIT, target.capacity ?? 1)) : 1;
}

// Legacy prose is preserved, but never silently treated as a reuse permission.
export const MEDIA_PERMISSION_KINDS = ['gallery', 'logo', 'contact', 'block'] as const;
export type MediaRights = { version: 1; license: string; permissions: { profileId: string; evidence: string; kinds: MediaLibraryTarget['kind'][] }[] };
export function readMediaRights(raw: string | undefined): MediaRights {
    try {
        const value = JSON.parse(raw ?? '');
        if (value.version === 1 && typeof value.license === 'string' && Array.isArray(value.permissions) && value.permissions.every((p: { profileId?: unknown; evidence?: unknown; kinds?: unknown }) => typeof p.profileId === 'string' && /^[0-9a-f-]{36}$/i.test(p.profileId) && typeof p.evidence === 'string' && p.evidence.trim() && Array.isArray(p.kinds) && p.kinds.length > 0 && p.kinds.length <= 4 && new Set(p.kinds).size === p.kinds.length && p.kinds.every(k => MEDIA_PERMISSION_KINDS.includes(k)))) return value;
    } catch { /* Unstructured license information is not a grant. */ }
    return { version: 1, license: raw ?? '', permissions: [] };
}
export function mediaMayUse(asset: Pick<MediaAsset, 'profile_id' | 'bucket_id' | 'rights'>, profileId: string, kind: MediaLibraryTarget['kind'] = 'gallery') {
    return !mediaNeedsRights(asset, profileId) || readMediaRights(asset.rights).permissions.some(p => p.profileId === profileId && p.kinds.includes(kind) && p.evidence.trim());
}
export function recordMediaPermission(original: string, license: string, profileId: string, evidence: string, kinds: readonly MediaLibraryTarget['kind'][] = MEDIA_PERMISSION_KINDS) {
    const existing = readMediaRights(original);
    const permissions = existing.permissions.filter(p => p.profileId !== profileId);
    if (profileId && evidence.trim()) permissions.push({ profileId, evidence: evidence.trim(), kinds: [...kinds] });
    if (!permissions.length && readMediaRights(license).license === license) return license;
    return JSON.stringify({ version: 1, license, permissions });
}
// Literal substring search with fixed German spelling alternatives, no user regex.
export function companySearchPattern(query: string) {
    const folded = query.trim().slice(0, 80).toLowerCase().normalize('NFC').replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü');
    const alternatives: Record<string, string> = { a: '(a|ä|ae)', ä: '(a|ä|ae)', o: '(o|ö|oe)', ö: '(o|ö|oe)', u: '(u|ü|ue)', ü: '(u|ü|ue)', 'ß': '(ß|ss)' };
    return Array.from(folded).map(c => alternatives[c] ?? c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('').replace(/ss/g, '(ss|ß)');
}
