"use client";

import { createClient } from "./supabase/client";
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, type MediaState } from "./company-media";
import { optimizeProfileImage } from "./client-image-optimization";

// Shared by the legacy admin media page and the inline profile editor.
export async function uploadAdminMedia(
  saveAction: (form: FormData) => Promise<MediaState>,
  kind: "logo" | "gallery" | "contact",
  file: FormDataEntryValue | null,
  alt: string,
  onProgress: (label: string) => void,
  replacementId?: string,
): Promise<MediaState> {
  const prepare = new FormData();
  prepare.set("intent", `prepare-${kind}`);
  const finish = new FormData();
  finish.set("intent", `${kind}-upload`);
  finish.set("alt_text", alt);
  if (replacementId && kind === "gallery") {
    prepare.set("image_id", replacementId);
    finish.set("image_id", replacementId);
  }
  return uploadPreparedAdminMedia(saveAction, file, prepare, finish, onProgress);
}

export async function uploadPreparedAdminMedia(
  saveAction: (form: FormData) => Promise<MediaState>,
  file: FormDataEntryValue | null,
  prepare: FormData,
  finish: FormData,
  onProgress: (label: string) => void,
): Promise<MediaState> {
  if (!(file instanceof File)) return { error: "Bitte wählen Sie eine Bilddatei." };
  let path: string | undefined;
  try {
    onProgress("Bild wird optimiert …");
    file = await optimizeProfileImage(file);
    if (file.size > MEDIA_MAX_BYTES) return { error: "Das Bild ist nach der Optimierung noch zu groß." };
    prepare.set("file_type", file.type);
    prepare.set("file_size", String(file.size));
    const prepared = await saveAction(prepare);
    if (!prepared.uploadPath) return prepared;
    path = prepared.uploadPath;
    onProgress("Bild wird hochgeladen …");
    const storage = createClient().storage.from(MEDIA_BUCKET);
    const uploaded = await storage.upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error("Upload failed");
    onProgress("Bild wird gespeichert …");
    finish.set("uploaded_path", path);
    const result = await saveAction(finish);
    if (result.error) await storage.remove([path]);
    return result;
  } catch (error) {
    if (path) {
      try {
        await createClient().storage.from(MEDIA_BUCKET).remove([path]);
      } catch {
        // An orphan remains private if cleanup also fails.
      }
    }
    return { error: error instanceof Error && /^(Das Bild|Bitte)/.test(error.message)
      ? error.message : "Das Bild konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut." };
  }
}
