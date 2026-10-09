import type { MediaAsset } from './media-library';
import { MEDIA_MAX_BYTES } from './company-media';
const MEDIA_MIME_TYPES = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' } as const;
// Read-only selection: no campaign or storage write occurs until the existing form is saved.
export async function selectedBannerFile(asset: MediaAsset, request: typeof fetch = fetch): Promise<File> {
  if (!asset.src || asset.archived_at) throw Error('Dieses Bild ist nicht verfügbar.');
  const response = await request(asset.src, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok || Number(response.headers.get('content-length')) > MEDIA_MAX_BYTES) throw Error('Das Bild konnte nicht geladen werden.');
  const reader = response.body?.getReader();
  if (!reader) throw Error('Das Bild konnte nicht geladen werden.');
  const parts: Uint8Array[] = []; let size = 0;
  for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MEDIA_MAX_BYTES) { await reader.cancel(); throw Error('Bitte wählen Sie ein Bild mit maximal 5 MB.'); } parts.push(part.value); }
  const type = response.headers.get('content-type')?.split(';')[0] ?? '';
  if (!(type in MEDIA_MIME_TYPES) || !size) throw Error('Bitte wählen Sie JPEG, PNG oder WebP.');
  return new File(parts as BlobPart[], asset.name + '.' + MEDIA_MIME_TYPES[type as keyof typeof MEDIA_MIME_TYPES], { type });
}
