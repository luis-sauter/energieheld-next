import { retainedProfileMedia } from "./media-retention";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, validateMediaFile, type MediaState } from "./company-media";

export function isContactImagePath(id: string, path: unknown): path is string {
  return typeof path === "string" && path.startsWith(`profiles/${id}/contact/`) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(path.slice(`profiles/${id}/contact/`.length));
}
// Authorization and profile identity come from the existing owner/admin callers.
export async function changeAuthorizedContactImage(client: SupabaseClient, profile: {id: string; contact_image_path?: string | null}, form: FormData): Promise<MediaState> {
  const previous = profile.contact_image_path ?? null, intent = form.get("intent");
  const storage = client.storage.from(MEDIA_BUCKET);
  const cleanup = async (path: string | null) => {
    if (!isContactImagePath(profile.id, path)) return;
    if (await retainedProfileMedia(client, path)) return;
    try { const result = await storage.remove([path]); if (result.error) console.error("Contact image cleanup failed."); }
    catch { console.error("Contact image cleanup failed."); }
  };
  if (intent === "prepare-contact") {
    const mime = form.get("file_type"), size = Number(form.get("file_size"));
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : null;
    if (!ext || !Number.isSafeInteger(size) || size <= 0 || size > MEDIA_MAX_BYTES) return {error:"Bitte wählen Sie JPG, PNG oder WebP mit maximal 5 MB."};
    return {uploadPath: `profiles/${profile.id}/contact/${crypto.randomUUID()}.${ext}`};
  }
  const failure = "Das Ansprechpartnerbild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";
  let next: string | null = null;
  if (intent === "contact-upload") {
    const path = form.get("uploaded_path");
    if (!isContactImagePath(profile.id, path) || path === previous) return {error:"Der Upload gehört nicht zu diesem Profil oder ist bereits gespeichert."};
    try {
    const downloaded = await storage.download(path);
    if (downloaded.error || !downloaded.data) { await cleanup(path); return {error:failure}; }
    const checked = await validateMediaFile(new File([downloaded.data], "contact", {type:downloaded.data.type}));
    if (checked.error || !path.endsWith(`.${checked.extension}`)) { await cleanup(path); return {error:checked.error ?? "Dateiformat und Upload stimmen nicht überein."}; }
    next = path;
    } catch { await cleanup(path); return {error:failure}; }
  } else if (intent !== "contact-remove" || !previous) return {error:"Es ist kein Ansprechpartnerbild vorhanden."};
  let query = client.from("company_profiles").update({contact_image_path:next}).eq("id",profile.id);
  query = previous ? query.eq("contact_image_path",previous) : query.is("contact_image_path",null);
  try { const result = await query.select("id").maybeSingle();
    if (result.error || result.data?.id !== profile.id) { await cleanup(next); return {error:failure}; }
  } catch { await cleanup(next); return {error:failure}; }
  await cleanup(previous);
  return {success:next ? "Das Ansprechpartnerbild wurde gespeichert." : "Das Ansprechpartnerbild wurde entfernt."};
}
