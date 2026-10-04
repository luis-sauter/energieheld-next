"use client";
import { createClient } from "./supabase/client";
import { VIDEO_BUCKET, validateVideoFile } from "./profile-video";
import type { MediaState } from "./company-media";

// The same prepare/direct private Storage upload/server-validated finish used
// for images, without image processing or a large Server Action request body.
export async function uploadProfileVideo(save: (form: FormData) => Promise<MediaState>, file: File, progress: (label: string) => void): Promise<MediaState> {
  const checked = await validateVideoFile(file);
  if (checked.error) return { error: checked.error };
  const prepare = new FormData();
  prepare.set("intent", "prepare-video"); prepare.set("file_type", file.type); prepare.set("file_size", String(file.size));
  const prepared = await save(prepare);
  if (!prepared.uploadPath) return prepared;
  const storage = createClient().storage.from(VIDEO_BUCKET), path = prepared.uploadPath;
  try {
    progress("Video wird hochgeladen …");
    const uploaded = await storage.upload(path, file, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error("Upload failed");
    progress("Video wird geprüft und gespeichert …");
    const finish = new FormData(); finish.set("intent", "video-upload"); finish.set("uploaded_path", path);
    const result = await save(finish);
    if (result.error) await storage.remove([path]);
    return result;
  } catch {
    try { await storage.remove([path]); } catch { /* The object remains private. */ }
    return { error: "Das Video konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut." };
  }
}
