import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortalImage } from "@/types/portal";

export const MEDIA_BUCKET = "company-media";
export const MEDIA_MAX_BYTES = 5242880;
export const GALLERY_LIMIT = 8;
export type MediaRow = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
};
export type MediaProfile = {
  id: string;
  display_name: string;
  logo_path?: string | null;
  company_profile_images?: MediaRow[];
};
export type SignedMedia = {
  logo?: PortalImage;
  images: (PortalImage & { id: string })[];
};
export type MediaState = {
  uploadPath?: string;
  error?: string;
  success?: string;
  unauthenticated?: boolean;
};
const errorMessage =
  "Die Medien konnten nicht gespeichert werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.";

export async function signCompanyMedia(
  client: SupabaseClient,
  profile: MediaProfile,
): Promise<SignedMedia> {
  const rows = [...(profile.company_profile_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const paths = [
    profile.logo_path,
    ...rows.map((row) => row.storage_path),
  ].filter((path): path is string => Boolean(path));
  if (!paths.length) return { images: [] };
  if (paths.some((path) => !path.startsWith(`profiles/${profile.id}/`)))
    throw new Error("Invalid media reference");
  const { data, error } = await client.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error || !data || data.some((item) => item.error || !item.signedUrl))
    throw new Error("Media unavailable");
  const urls = new Map(data.map((item) => [item.path, item.signedUrl]));
  const src = (path: string) => {
    const value = urls.get(path);
    if (!value) throw new Error("Media unavailable");
    return value;
  };
  return {
    logo: profile.logo_path
      ? { src: src(profile.logo_path), alt: `Logo von ${profile.display_name}` }
      : undefined,
    images: rows.map((row) => ({
      id: row.id,
      src: src(row.storage_path),
      alt:
        row.alt_text?.trim() || `Unternehmensbild von ${profile.display_name}`,
    })),
  };
}

export async function validateMediaFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size === 0)
    return { error: "Bitte wählen Sie eine nicht leere Bilddatei." };
  if (value.size > MEDIA_MAX_BYTES)
    return { error: "Die Datei darf maximal 5 MB groß sein." };
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[value.type];
  if (!extension)
    return {
      error:
        "Bitte verwenden Sie JPG, PNG oder WebP. SVG und andere Dateitypen sind nicht erlaubt.",
    };
  // Check signatures as well as the user-supplied MIME type.
  const bytes = new Uint8Array(await value.slice(0, 12).arrayBuffer());
  const matches =
    extension === "jpg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : extension === "png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every(
            (byte, index) => bytes[index] === byte,
          )
        : bytes.length >= 12 &&
          new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
          new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!matches)
    return { error: "Die Datei entspricht keinem unterstützten Bildformat." };
  return { file: value, extension };
}

export async function changeOwnCompanyMedia(
  client: SupabaseClient,
  form: FormData,
): Promise<MediaState> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) return { unauthenticated: true };
  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (companyError || !company) return { error: errorMessage };
  const { data: profile, error: profileError } = await client
    .from("company_profiles")
    .select(
      "id,logo_path,company_profile_images(id,storage_path,alt_text,sort_order)",
    )
    .eq("company_id", company.id)
    .maybeSingle();
  if (profileError || !profile) return { error: errorMessage };
  const rows = (profile.company_profile_images as MediaRow[]).sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const storage = client.storage.from(MEDIA_BUCKET);
  const cleanup = async (path: string | null) => {
    if (!path) return;
    try {
      const result = await storage.remove([path]);
      if (result.error) console.error("Company media cleanup failed.");
    } catch {
      console.error("Company media cleanup failed.");
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
    if (
      !extension ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > MEDIA_MAX_BYTES
    )
      return { error: "Bitte wählen Sie JPG, PNG oder WebP mit maximal 5 MB." };
    if (intent === "prepare-gallery" && rows.length >= GALLERY_LIMIT)
      return { error: "Es sind maximal 8 Unternehmensbilder möglich." };
    return {
      uploadPath: `profiles/${profile.id}/${intent === "prepare-logo" ? "logo" : "gallery"}/${crypto.randomUUID()}.${extension}`,
    };
  }
  if (intent === "logo-upload" || intent === "gallery-upload") {
    if (intent === "gallery-upload" && rows.length >= GALLERY_LIMIT)
      return { error: "Es sind maximal 8 Unternehmensbilder möglich." };
    const uploadedPath = form.get("uploaded_path");
    let uploadedFile: File | null = null;
    if (typeof uploadedPath === "string") {
      const prefix = `profiles/${profile.id}/${intent === "logo-upload" ? "logo" : "gallery"}/`;
      if (
        !uploadedPath.startsWith(prefix) ||
        !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(
          uploadedPath.slice(prefix.length),
        )
      )
        return {
          error: "Der Upload gehört nicht zu diesem Profil oder Bildtyp.",
        };
      // Download through the authenticated Storage API and validate actual bytes,
      // not metadata supplied by the browser. Large bodies never traverse Netlify.
      const downloaded = await storage.download(uploadedPath);
      if (downloaded.error || !downloaded.data) return { error: errorMessage };
      uploadedFile = new File([downloaded.data], "upload", {
        type: downloaded.data.type,
      });
    }
    const validated = await validateMediaFile(uploadedFile ?? form.get("file"));
    if (validated.error || !validated.file) {
      if (typeof uploadedPath === "string") await cleanup(uploadedPath);
      return { error: validated.error };
    }
    if (
      typeof uploadedPath === "string" &&
      !uploadedPath.endsWith("." + validated.extension)
    ) {
      await cleanup(uploadedPath);
      return { error: "Dateiformat und Upload-Pfad stimmen nicht überein." };
    }
    const alt = form.get("alt_text");
    if (typeof alt === "string" && alt.trim().length > 500)
      return {
        error: "Die Bildbeschreibung darf maximal 500 Zeichen lang sein.",
      };
    const path =
      typeof uploadedPath === "string"
        ? uploadedPath
        : `profiles/${profile.id}/${intent === "logo-upload" ? "logo" : "gallery"}/${crypto.randomUUID()}.${validated.extension}`;
    const { error: uploadError } =
      typeof uploadedPath === "string"
        ? { error: null }
        : await storage.upload(path, validated.file, {
            contentType: validated.file.type,
            upsert: false,
          });
    if (uploadError)
      return {
        error:
          "Das Bild konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.",
      };
    let saved = false;
    try {
      if (intent === "logo-upload") {
        let query = client
          .from("company_profiles")
          .update({ logo_path: path })
          .eq("id", profile.id)
          .eq("company_id", company.id);
        query = profile.logo_path
          ? query.eq("logo_path", profile.logo_path)
          : query.is("logo_path", null);
        const result = await query.select("id").maybeSingle();
        saved = !result.error && Boolean(result.data);
      } else {
        const result = await client
          .from("company_profile_images")
          .insert({
            profile_id: profile.id,
            storage_path: path,
            alt_text: typeof alt === "string" ? alt.trim() || null : null,
            sort_order: rows.length
              ? Math.max(...rows.map((row) => row.sort_order)) + 1
              : 0,
          })
          .select("id")
          .maybeSingle();
        saved = !result.error && Boolean(result.data);
      }
    } catch {
      /* RLS-protected cleanup below also refuses referenced objects. */
    }
    if (!saved) {
      await cleanup(path);
      return { error: errorMessage };
    }
    if (intent === "logo-upload") await cleanup(profile.logo_path);
    return {
      success:
        "Das Bild wurde gespeichert. Reichen Sie Ihr Profil anschließend zur Prüfung ein.",
    };
  }
  if (intent === "logo-remove") {
    if (!profile.logo_path) return { error: "Es ist kein Logo vorhanden." };
    const { data, error } = await client
      .from("company_profiles")
      .update({ logo_path: null })
      .eq("id", profile.id)
      .eq("company_id", company.id)
      .eq("logo_path", profile.logo_path)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: errorMessage };
    await cleanup(profile.logo_path);
    return { success: "Das Logo wurde entfernt." };
  }
  const id = form.get("image_id");
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0)
    return {
      error:
        "Das Bild gehört nicht zu Ihrem Firmenprofil oder wurde bereits entfernt.",
    };
  if (intent === "gallery-remove") {
    const { data, error } = await client
      .from("company_profile_images")
      .delete()
      .eq("profile_id", profile.id)
      .eq("id", rows[index].id)
      .select("id")
      .maybeSingle();
    if (error || !data) return { error: errorMessage };
    await cleanup(rows[index].storage_path);
    return { success: "Das Unternehmensbild wurde entfernt." };
  }
  if (intent === "gallery-up" || intent === "gallery-down") {
    const target = index + (intent === "gallery-up" ? -1 : 1);
    if (target < 0 || target >= rows.length)
      return { error: "Das Bild kann nicht weiter verschoben werden." };
    [rows[index], rows[target]] = [rows[target], rows[index]];
    const { error } = await client.rpc("reorder_company_images", {
      p_profile_id: profile.id,
      p_image_ids: rows.map((row) => row.id),
    });
    return error
      ? { error: errorMessage }
      : { success: "Die Reihenfolge wurde gespeichert." };
  }
  return { error: "Bitte wählen Sie eine gültige Medienaktion." };
}
