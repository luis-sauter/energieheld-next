import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId, type AdminAccess } from "./admin-review";
import {
  GALLERY_LIMIT,
  MEDIA_BUCKET,
  MEDIA_MAX_BYTES,
  validateMediaFile,
  type MediaRow,
  type MediaState,
} from "./company-media";

export type AdminMediaResult = MediaState & { access: AdminAccess };
const saveError =
  "Die Medien konnten nicht gespeichert werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.";

export async function changeAdminCompanyMedia(
  client: SupabaseClient,
  profileId: unknown,
  form: FormData,
): Promise<AdminMediaResult> {
  const access = await checkAdmin(client);
  if (access !== "admin") return { access };
  if (!isProfileId(profileId))
    return { access, error: "Das Firmenprofil wurde nicht gefunden." };
  const { data: profile, error: profileError } = await client
    .from("company_profiles")
    .select("id,logo_path,company_profile_images(id,storage_path,alt_text,sort_order)")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile)
    return { access, error: "Das Firmenprofil konnte nicht geladen werden." };

  const rows = [...(profile.company_profile_images as MediaRow[])].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const storage = client.storage.from(MEDIA_BUCKET);
  const cleanup = async (path: string | null) => {
    if (!path) return;
    try {
      const { error } = await storage.remove([path]);
      if (error) console.error("Admin media cleanup failed.");
    } catch {
      console.error("Admin media cleanup failed.");
    }
  };
  const intent = form.get("intent");

  if (intent === "prepare-logo" || intent === "prepare-gallery") {
    const mime = form.get("file_type");
    const size = Number(form.get("file_size"));
    const extension =
      mime === "image/jpeg"
        ? "jpg"
        : mime === "image/png"
          ? "png"
          : mime === "image/webp"
            ? "webp"
            : null;
    if (!extension || !Number.isSafeInteger(size) || size <= 0 || size > MEDIA_MAX_BYTES)
      return { access, error: "Bitte wählen Sie JPG, PNG oder WebP mit maximal 5 MB." };
    if (intent === "prepare-gallery" && rows.length >= GALLERY_LIMIT)
      return { access, error: "Es sind maximal 8 Bilder möglich." };
    return {
      access,
      uploadPath: `profiles/${profile.id}/${intent === "prepare-logo" ? "logo" : "gallery"}/${crypto.randomUUID()}.${extension}`,
    };
  }

  if (intent === "logo-upload" || intent === "gallery-upload") {
    if (intent === "gallery-upload" && rows.length >= GALLERY_LIMIT)
      return { access, error: "Es sind maximal 8 Bilder möglich." };
    const path = form.get("uploaded_path");
    const kind = intent === "logo-upload" ? "logo" : "gallery";
    const prefix = `profiles/${profile.id}/${kind}/`;
    if (
      typeof path !== "string" ||
      !path.startsWith(prefix) ||
      !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path.slice(prefix.length))
    )
      return { access, error: "Der Upload gehört nicht zu diesem Profil oder Bildtyp." };
    const alt = form.get("alt_text");
    if (typeof alt === "string" && alt.trim().length > 500) {
      await cleanup(path);
      return { access, error: "Die Bildbeschreibung darf maximal 500 Zeichen lang sein." };
    }
    const downloaded = await storage.download(path);
    if (downloaded.error || !downloaded.data) return { access, error: saveError };
    const file = new File([downloaded.data], "upload", { type: downloaded.data.type });
    const validated = await validateMediaFile(file);
    if (validated.error || !validated.file) {
      await cleanup(path);
      return { access, error: validated.error };
    }
    if (!path.endsWith(`.${validated.extension}`)) {
      await cleanup(path);
      return { access, error: "Dateiformat und Upload-Pfad stimmen nicht überein." };
    }

    let saved = false;
    try {
      if (kind === "logo") {
        let query = client.from("company_profiles")
          .update({ logo_path: path })
          .eq("id", profile.id);
        query = profile.logo_path
          ? query.eq("logo_path", profile.logo_path)
          : query.is("logo_path", null);
        const result = await query.select("id").maybeSingle();
        saved = !result.error && result.data?.id === profile.id;
      } else {
        const result = await client.from("company_profile_images")
          .insert({
            profile_id: profile.id,
            storage_path: path,
            alt_text: typeof alt === "string" ? alt.trim() || null : null,
            sort_order: rows.length ? Math.max(...rows.map((row) => row.sort_order)) + 1 : 0,
          })
          .select("id")
          .maybeSingle();
        saved = !result.error && Boolean(result.data);
      }
    } catch {
      // RLS still guards cleanup if the metadata write failed.
    }
    if (!saved) {
      await cleanup(path);
      return { access, error: saveError };
    }
    if (kind === "logo") await cleanup(profile.logo_path);
    return { access, success: "✓ Bild hochgeladen" };
  }

  if (intent === "logo-remove") {
    if (!profile.logo_path) return { access, error: "Es ist kein Logo vorhanden." };
    const { data, error } = await client.from("company_profiles")
      .update({ logo_path: null })
      .eq("id", profile.id)
      .eq("logo_path", profile.logo_path)
      .select("id")
      .maybeSingle();
    if (error || data?.id !== profile.id) return { access, error: saveError };
    await cleanup(profile.logo_path);
    return { access, success: "Das Logo wurde entfernt." };
  }

  if (intent === "gallery-reorder") {
    const ids = form.getAll("image_ids");
    if (
      ids.length !== rows.length ||
      new Set(ids).size !== rows.length ||
      ids.some((id) => typeof id !== "string" || !rows.some((row) => row.id === id))
    )
      return { access, error: "Die Bilder haben sich geändert. Bitte laden Sie die Seite neu." };
    const { error } = await client.rpc("reorder_company_images", {
      p_profile_id: profile.id,
      p_image_ids: ids,
    });
    return error
      ? { access, error: saveError }
      : { access, success: "Die Reihenfolge wurde gespeichert." };
  }

  const imageId = form.get("image_id");
  const image = rows.find((row) => row.id === imageId);
  if (!image)
    return { access, error: "Das Bild gehört nicht zu diesem Profil oder wurde entfernt." };

  if (intent === "gallery-alt") {
    const alt = form.get("alt_text");
    if (typeof alt !== "string" || alt.trim().length > 500)
      return { access, error: "Die Bildbeschreibung darf maximal 500 Zeichen lang sein." };
    const { data, error } = await client.from("company_profile_images")
      .update({ alt_text: alt.trim() || null })
      .eq("profile_id", profile.id)
      .eq("id", image.id)
      .select("id")
      .maybeSingle();
    return error || data?.id !== image.id
      ? { access, error: saveError }
      : { access, success: "Die Bildbeschreibung wurde gespeichert." };
  }

  if (intent === "gallery-remove") {
    const { data, error } = await client.from("company_profile_images")
      .delete()
      .eq("profile_id", profile.id)
      .eq("id", image.id)
      .select("id")
      .maybeSingle();
    if (error || data?.id !== image.id) return { access, error: saveError };
    await cleanup(image.storage_path);
    return { access, success: "Das Bild wurde entfernt." };
  }
  return { access, error: "Bitte wählen Sie eine gültige Medienaktion." };
}
