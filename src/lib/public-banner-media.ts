import 'server-only';
import { createPublicClient } from './supabase/public';
import { signAdImages } from './ad-campaigns';
import type { ActiveAd } from './ad-values';

// Resolve only creatives chosen for display. Never share signed URLs across
// requests/users, and never let the metadata-only marker reach an <img>.
export async function signSelectedPublicBanners(rows: ActiveAd[]): Promise<ActiveAd[]> {
  const pending = [...new Map(rows.filter(row => row.imageUrl === 'public-creative')
    .map(row => [`${row.id}:${row.image_path}`, row])).values()];
  if (!pending.length) return rows;
  let signed: ActiveAd[] = [];
  try { signed = await signAdImages(createPublicClient(), pending); }
  catch { /* Keep public content usable while unavailable media stays hidden. */ }
  const urls = new Map(signed.map(row => [`${row.id}:${row.image_path}`, row.imageUrl]));
  return rows.map(row => row.imageUrl === 'public-creative'
    ? { ...row, imageUrl: urls.get(`${row.id}:${row.image_path}`), suppressed: row.suppressed || !urls.get(`${row.id}:${row.image_path}`) }
    : row);
}
