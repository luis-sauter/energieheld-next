import type { SupabaseClient } from "@supabase/supabase-js";
import { isProfileId, type AdminAccess } from "./admin-review";
import { checkInlineProfileTarget } from "./inline-admin-profile";
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, validateMediaFile, type MediaState } from "./company-media";
import { hasPersistedImageGridSize, normalizeImageGridConfig, parseImageGridSize } from "./image-grid-layout";
import { clampBlockOffset, hasPersistedBlockLayout } from "./content-block-layout";
import { DEFAULT_IMAGE_CROP, hasPersistedImageCrop, parseImageCrop, type ImageCrop } from "./image-crop";
import { parseImageCaption } from "./image-caption";

export type BlockImageResult = MediaState & { access: AdminAccess };
const failed = "Der Bildblock konnte nicht gespeichert werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.";
const missing = "Der Bildblock oder das Bild gehört nicht zu diesem Profil.";
type ImageRow = Partial<ImageCrop> & { id: string; block_id: string; storage_path: string; sort_order: number; caption?: string | null };

export async function changeAdminBlockImages(
  client: SupabaseClient, profileId: unknown, slug: unknown, form: FormData,
): Promise<BlockImageResult> {
  const target = await checkInlineProfileTarget(client, profileId, slug);
  if (target.access !== "admin" || target.error) return target;
  const blockId = form.get("block_id");
  if (!isProfileId(blockId)) return { access: "admin", error: missing };
  const id = profileId as string;
  const { data: block, error: blockError } = await client.from("profile_content_blocks")
    .select("id,type,config").eq("id", blockId).eq("profile_id", id).is("slot", null).maybeSingle();
  if (blockError || block?.type !== "image_grid") return { access: "admin", error: missing };
  const { data, error: imagesError } = await client.from("profile_content_block_images")
    .select("*").eq("block_id", blockId)
    .order("sort_order").order("id");
  if (imagesError) return { access: "admin", error: failed };
  const images = (data ?? []) as ImageRow[];
  const intent = form.get("intent");
  const config = normalizeImageGridConfig(block.config);
  const storage = client.storage.from(MEDIA_BUCKET);
  const cleanup = async (path: string) => {
    try {
      const removed = await storage.remove([path]);
      if (removed.error) console.error("Block image cleanup failed.");
    } catch { console.error("Block image cleanup failed."); }
  };
  const imageId = form.get("image_id");
  const image = images.find((row) => row.id === imageId);

  if (intent === "caption") {
    if (!image) return { access: "admin", error: missing };
    if (!("caption" in image))
      return { access: "admin", error: "Der Text unter dem Bild ist nach der Datenbankaktualisierung verfügbar." };
    const caption = parseImageCaption(form.get("caption"));
    if (caption === undefined)
      return { access: "admin", error: "Bitte geben Sie höchstens 500 Zeichen als einfachen Text ein." };
    const result = await client.from("profile_content_block_images")
      .update({ caption }).eq("id", image.id).eq("block_id", blockId)
      .select("id").maybeSingle();
    return result.error || result.data?.id !== image.id
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Der Text unter dem Bild wurde gespeichert." };
  }

  if (intent === "crop") {
    if (!image) return { access: "admin", error: missing };
    if (!hasPersistedImageCrop(image))
      return { access: "admin", error: "Die Ausschnittbearbeitung ist nach der Datenbankaktualisierung verfügbar." };
    const crop = parseImageCrop(form.get("focus_x"), form.get("focus_y"), form.get("zoom"));
    if (!crop) return { access: "admin", error: "Bitte wählen Sie einen gültigen Bildausschnitt und Zoom." };
    const result = await client.from("profile_content_block_images")
      .update(crop).eq("id", image.id).eq("block_id", blockId).select("id").maybeSingle();
    return result.error || result.data?.id !== image.id
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Der Bildausschnitt wurde gespeichert." };
  }

  if (intent === "layout") {
    const columns = Number(form.get("columns"));
    if (!Number.isInteger(columns) || columns < 1 || columns > 4)
      return { access: "admin", error: "Bitte wählen Sie ein Layout mit 1 bis 4 Bildern." };
    if (images.length > columns)
      return { access: "admin", error: "Entfernen Sie zuerst Bilder, bevor Sie das Layout verkleinern." };
    const nextConfig = hasPersistedBlockLayout(block.config)
      ? { ...config, columns }
      : hasPersistedImageGridSize(block.config)
      ? { columns, width_percent: config.width_percent, aspect_ratio: config.aspect_ratio }
      : { columns }; // Older environments still accept their original config shape.
    const result = await client.from("profile_content_blocks")
      .update({ config: nextConfig }).eq("id", blockId).eq("profile_id", id)
      .eq("type", "image_grid").is("slot", null).select("id").maybeSingle();
    return result.error || result.data?.id !== blockId
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Das Bildlayout wurde gespeichert." };
  }

  if (intent === "resize") {
    if (!hasPersistedImageGridSize(block.config))
      return { access: "admin", error: "Die Größenänderung ist verfügbar, sobald die neue Datenbankmigration angewendet ist." };
    const size = parseImageGridSize(form.get("width_percent"), form.get("aspect_ratio"));
    if (!size) return { access: "admin", error: "Bitte wählen Sie eine gültige Bildblockgröße." };
    const nextConfig = hasPersistedBlockLayout(block.config)
      ? { ...config, ...size, offset_percent: clampBlockOffset(size.width_percent, config.offset_percent) }
      : { columns: config.columns, ...size };
    const result = await client.from("profile_content_blocks")
      .update({ config: nextConfig })
      .eq("id", blockId).eq("profile_id", id).eq("type", "image_grid").is("slot", null)
      .select("id").maybeSingle();
    return result.error || result.data?.id !== blockId
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Die Bildblockgröße wurde gespeichert." };
  }

  if (intent === "reorder") {
    const ids = form.getAll("image_ids");
    if (ids.length !== images.length || new Set(ids).size !== images.length ||
      ids.some((item) => typeof item !== "string" || !images.some((row) => row.id === item)))
      return { access: "admin", error: "Die Bilder haben sich geändert. Bitte laden Sie die Seite neu." };
    const result = await client.rpc("reorder_profile_block_images", {
      p_profile_id: id, p_block_id: blockId, p_image_ids: ids,
    });
    return result.error
      ? { access: "admin", error: failed }
      : { access: "admin", success: "Die Bildreihenfolge wurde gespeichert." };
  }

  if (intent === "alt" || intent === "remove") {
    if (!image) return { access: "admin", error: missing };
    if (intent === "alt") {
      const alt = form.get("alt_text");
      if (typeof alt !== "string" || alt.trim().length > 500)
        return { access: "admin", error: "Die Bildbeschreibung darf maximal 500 Zeichen lang sein." };
      const result = await client.from("profile_content_block_images")
        .update({ alt_text: alt.trim() || null }).eq("id", image.id).eq("block_id", blockId)
        .select("id").maybeSingle();
      return result.error || result.data?.id !== image.id
        ? { access: "admin", error: failed }
        : { access: "admin", success: "Die Bildbeschreibung wurde gespeichert." };
    }
    const result = await client.rpc("remove_profile_block_image", {
      p_profile_id: id, p_block_id: blockId, p_image_id: image.id,
    });
    if (result.error || result.data !== image.storage_path) return { access: "admin", error: failed };
    await cleanup(image.storage_path);
    return { access: "admin", success: "Das Bild wurde entfernt." };
  }

  if (intent !== "prepare" && intent !== "upload")
    return { access: "admin", error: "Die Bildaktion ist ungültig." };
  if (imageId !== null && !image) return { access: "admin", error: missing };
  if (!image && (images.length >= 4 || images.length >= Number(block.config?.columns)))
    return { access: "admin", error: "Für dieses Layout ist kein weiterer Bildplatz frei." };

  const mime = form.get("file_type");
  const extension = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : null;
  if (intent === "prepare") {
    const size = Number(form.get("file_size"));
    if (!extension || !Number.isSafeInteger(size) || size <= 0 || size > MEDIA_MAX_BYTES)
      return { access: "admin", error: "Bitte wählen Sie JPG, PNG oder WebP mit maximal 5 MB." };
    return { access: "admin", uploadPath: `profiles/${id}/blocks/${blockId}/${crypto.randomUUID()}.${extension}` };
  }

  const path = form.get("uploaded_path");
  const prefix = `profiles/${id}/blocks/${blockId}/`;
  if (typeof path !== "string" || !path.startsWith(prefix) ||
    !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path.slice(prefix.length)))
    return { access: "admin", error: "Der Upload gehört nicht zu diesem Bildblock." };
  const alt = form.get("alt_text");
  if (typeof alt !== "string" || alt.trim().length > 500) {
    await cleanup(path);
    return { access: "admin", error: "Die Bildbeschreibung darf maximal 500 Zeichen lang sein." };
  }
  const downloaded = await storage.download(path);
  if (downloaded.error || !downloaded.data) return { access: "admin", error: failed };
  const validated = await validateMediaFile(new File([downloaded.data], "upload", { type: downloaded.data.type }));
  if (validated.error || !validated.file || !path.endsWith(`.${validated.extension}`)) {
    await cleanup(path);
    return { access: "admin", error: validated.error ?? "Dateiformat und Upload stimmen nicht überein." };
  }
  if (image) {
    const result = await client.from("profile_content_block_images")
      .update({ storage_path: path, alt_text: alt.trim() || null,
        ...(hasPersistedImageCrop(image) ? DEFAULT_IMAGE_CROP : {}) })
      .eq("id", image.id).eq("block_id", blockId).eq("storage_path", image.storage_path)
      .select("id").maybeSingle();
    if (result.error || result.data?.id !== image.id) {
      await cleanup(path);
      return { access: "admin", error: failed };
    }
    await cleanup(image.storage_path);
    return { access: "admin", success: "Das Bild wurde ersetzt." };
  }
  const result = await client.from("profile_content_block_images")
    .insert({ block_id: blockId, storage_path: path, alt_text: alt.trim() || null, sort_order: images.length })
    .select("id").maybeSingle();
  if (result.error || !result.data?.id) {
    await cleanup(path);
    return { access: "admin", error: failed };
  }
  return { access: "admin", success: "Das Bild wurde hinzugefügt." };
}
