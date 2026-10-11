import type { MediaLibraryPage } from './media-library';

// Catalog reads use abortable GET requests, outside Next's serialized action queue.
export async function fetchMediaLibraryPage(profile: string | null, kind: string, query: string, page: number, archived: boolean, signal: AbortSignal): Promise<MediaLibraryPage> {
  const params = new URLSearchParams({ kind, query, page: String(page), archived: String(archived) });
  if (profile) params.set('profile', profile);
  const response = await fetch('/api/admin/media-library?' + params, { signal, cache: 'no-store', credentials: 'same-origin' });
  signal.throwIfAborted();
  const result = await response.json() as MediaLibraryPage;
  if (!Array.isArray(result.items) || !Number.isSafeInteger(result.count)) throw new Error('Invalid catalog response');
  return result;
}
