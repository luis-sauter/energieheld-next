import { isProfileId } from './admin-review';

export function readMediaLibraryRequest(params: URLSearchParams) {
  const profile = params.get('profile') || null, kind = params.get('kind') ?? '', query = params.get('query') ?? '';
  const rawPage = params.get('page') ?? '1', archived = params.get('archived') ?? 'false';
  if (profile !== null && !isProfileId(profile) || !['', 'gallery', 'logo', 'contact', 'block', 'banner', 'video', 'images', 'unused'].includes(kind) || query.length > 200 || !/^\d+$/.test(rawPage) || !['true', 'false'].includes(archived)) return null;
  const page = Number(rawPage);
  return Number.isSafeInteger(page) && page >= 1 && page <= 100000 ? { profile, kind, query, page, archived: archived === 'true' } : null;
}
