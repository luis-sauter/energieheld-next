export type MediaLibraryTarget = {
    profileId: string;
    kind: 'gallery' | 'logo' | 'contact' | 'block';
    blockId?: string;
    replacementId?: string;
    capacity?: number;
};
export type MediaAsset = {
    id: string;
    profile_id: string | null;
    profile_name: string | null;
    bucket_id: 'company-media' | 'ad-media' | 'project-media';
    storage_path: string;
    kind: string;
    name: string;
    description: string;
    alt_text: string;
    source: string;
    rights: string;
    archived_at: string | null;
    src: string;
    preview_file?: {
        bucket: 'company-media' | 'ad-media' | 'project-media';
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
    return target?.kind === 'gallery' && !target.replacementId ? Math.max(0, Math.min(8, target.capacity ?? 1)) : 1;
}
