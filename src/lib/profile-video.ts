import {externalVideoEmbed} from './external-video';
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaState } from "./company-media";

export const VIDEO_BUCKET = "company-profile-videos";
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_ACCEPT = "video/mp4,video/webm";
const failure = "Das Video konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";
export function videoExtension(mime: unknown) {
  return mime === "video/mp4" ? "mp4" : mime === "video/webm" ? "webm" : null;
}
export function isProfileVideoPath(profileId: string, path: unknown): path is string {
  return typeof path === "string" && path.startsWith(`profiles/${profileId}/video/`) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$/.test(path.slice(`profiles/${profileId}/video/`.length));
}
export async function validateVideoFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size) return { error: "Bitte wählen Sie eine Videodatei." };
  if (value.size > VIDEO_MAX_BYTES) return { error: "Das Video darf maximal 50 MB groß sein." };
  const extension = videoExtension(value.type);
  if (!extension) return { error: "Bitte verwenden Sie MP4 oder WebM." };
  const bytes = new Uint8Array(await value.slice(0, 4096).arrayBuffer());
  const text = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  // MP4 starts with a bounded ISO-BMFF ftyp box; WebM must identify its EBML
  // document type as webm (a Matroska header alone is not enough).
  const boxSize = bytes.length >= 12 ? new DataView(bytes.buffer).getUint32(0) : 0;
  const valid = extension === "mp4"
    ? boxSize >= 16 && boxSize <= value.size && boxSize <= bytes.length && text(4, 8) === "ftyp" &&
      Array.from({ length: Math.floor((boxSize - 8) / 4) }, (_, i) => text(8 + i * 4, 12 + i * 4))
        .some(brand => /^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)$/.test(brand))
    : bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 &&
      bytes.some((byte, index) => byte === 0x42 && bytes[index + 1] === 0x82 && bytes[index + 2] === 0x84 && text(index + 3, index + 7) === "webm");
  return valid ? { file: value, extension } : { error: "Die Datei entspricht keinem unterstützten Videoformat." };
}

// Called only AFTER the distinct owner/admin authorization and profile lookup.
export async function changeAuthorizedProfileVideo(client: SupabaseClient, profile: { id: string; video_path?: string | null }, form: FormData): Promise<MediaState> {
  const intent = form.get("intent"), previous = profile.video_path ?? null;
  const storage = client.storage.from(VIDEO_BUCKET);
  const cleanup = async (path: string | null) => {
    if (!isProfileVideoPath(profile.id, path)) return;
    try { await storage.remove([path]); } catch { /* Unlinked objects remain private. */ }
  };
  if (intent === "prepare-video") {
    const extension = videoExtension(form.get("file_type")), size = Number(form.get("file_size"));
    if (!extension || !Number.isSafeInteger(size) || size <= 0 || size > VIDEO_MAX_BYTES)
      return { error: "Bitte wählen Sie MP4 oder WebM mit maximal 50 MB." };
    return { uploadPath: `profiles/${profile.id}/video/${crypto.randomUUID()}.${extension}` };
  }
  let next: string | null = null;
  if (intent === "video-upload") {
    const path = form.get("uploaded_path");
    if (!isProfileVideoPath(profile.id, path) || path === previous)
      return { error: "Der Upload gehört nicht zu diesem Profil oder ist bereits gespeichert." };
    const downloaded = await storage.download(path);
    if (downloaded.error || !downloaded.data) return { error: failure };
    const checked = await validateVideoFile(new File([downloaded.data], "video", { type: downloaded.data.type }));
    if (checked.error || !path.endsWith(`.${checked.extension}`)) {
      await cleanup(path);
      return { error: checked.error ?? "Dateiformat und Upload stimmen nicht überein." };
    }
    next = path;
  } else if (intent !== "video-remove" || !previous) return { error: "Es ist kein Video vorhanden." };
  let query = client.from("company_profiles").update({ video_path: next }).eq("id", profile.id);
  query = previous ? query.eq("video_path", previous) : query.is("video_path", null);
  try {
    const result = await query.select("id").maybeSingle();
    if (result.error || result.data?.id !== profile.id) { await cleanup(next); return { error: failure }; }
  } catch { await cleanup(next); return { error: failure }; }
  // The catalog retains originals; removing a usage must never delete its source.
  return { success: next ? "Das Video wurde gespeichert." : "Das Video wurde entfernt. Die Galerie wird wieder angezeigt." };
}

export async function signProfileVideo(client: SupabaseClient, profile: { id: string; video_path?: string | null }) {
  if (profile.video_path && !isProfileVideoPath(profile.id, profile.video_path)) return undefined;
  if (!isProfileVideoPath(profile.id, profile.video_path)) {
    try {
      const ref=await client.from('profile_video_uses').select('external_url').eq('profile_id',profile.id).is('block_id',null).maybeSingle();
      return ref.data?.external_url && externalVideoEmbed(ref.data.external_url) ? {src:ref.data.external_url,external:true} : undefined;
    } catch { return undefined; }
  }
  try {
    const { data, error } = await client.storage.from(VIDEO_BUCKET).createSignedUrl(profile.video_path, 3600);
    return !error && data?.signedUrl ? { src: data.signedUrl } : undefined;
  } catch { return undefined; }
}
