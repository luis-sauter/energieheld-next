import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId } from "./admin-review";
import { validateMediaFile } from "./company-media";
import {
  validateAdValues,
  validAdDate,
  type AdCampaign,
  type ActiveAd,
  type AdFormState,
} from "./ad-values";
export const AD_BUCKET = "ad-media";
const failed =
  "Die Kampagne konnte nicht gespeichert werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.";
export async function ownAdProfile(client: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return { unauthenticated: true as const };
  const { data: company, error: companyError } = await client
    .from("companies")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (companyError || !company)
    return { error: "Zu Ihrem Konto wurde keine Firma gefunden." };
  const { data: profile, error: profileError } = await client
    .from("company_profiles")
    .select("id")
    .eq("company_id", company.id)
    .maybeSingle();
  return profileError || !profile
    ? { error: "Ihr Firmenprofil konnte nicht geladen werden." }
    : { profileId: profile.id as string };
}
export async function signAdImages<T extends ActiveAd>(
  client: SupabaseClient,
  rows: T[],
): Promise<T[]> {
  const paths = [
    ...new Set(rows.flatMap((r) => (r.image_path ? [r.image_path] : []))),
  ];
  if (!paths.length) return rows;
  if (
    rows.some(
      (r) =>
        r.image_path && !r.image_path.startsWith(`campaigns/${r.id}/creative/`),
    )
  )
    throw Error("Invalid ad media");
  const { data, error } = await client.storage
    .from(AD_BUCKET)
    .createSignedUrls(paths, 300);
  if (error || !data) throw Error("Ad images unavailable");
  const urls = new Map(
    data
      .filter((x) => !x.error && x.signedUrl)
      .map((x) => [x.path, x.signedUrl]),
  );
  return rows.map((r) => ({
    ...r,
    imageUrl: r.image_path ? urls.get(r.image_path) : undefined,
  }));
}
export async function loadAdCampaigns(
  client: SupabaseClient,
  admin = false,
  page = 1,
  id?: string,
) {
  let profileId: string | undefined;
  if (admin) {
    const access = await checkAdmin(client);
    if (access !== "admin") return { access };
  } else {
    const own = await ownAdProfile(client);
    if (!own.profileId) return own;
    profileId = own.profileId;
  }
  let query = client
    .from("company_ad_campaigns")
    .select("*,company_profiles!inner(display_name)", { count: "exact" });
  if (profileId) query = query.eq("profile_id", profileId);
  if (id) {
    if (!isProfileId(id)) return { campaigns: [] as AdCampaign[], count: 0 };
    query = query.eq("id", id);
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range((page - 1) * 20, page * 20 - 1);
  if (error)
    return { error: "Werbekampagnen konnten gerade nicht geladen werden." };
  const rows = (data ?? []).map((row) => ({
    ...row,
    companyName: (Array.isArray(row.company_profiles)
      ? row.company_profiles[0]
      : row.company_profiles
    )?.display_name,
  })) as AdCampaign[];
  try {
    return { campaigns: await signAdImages(client, rows), count: count ?? 0 };
  } catch {
    return {
      campaigns: rows,
      count: count ?? 0,
      error: "Die Bildvorschau ist gerade nicht verfügbar.",
    };
  }
}
export async function prepareAdUpload(
  client: SupabaseClient,
  form: FormData,
): Promise<AdFormState & { uploadPath?: string; unauthenticated?: boolean }> {
  const own = await ownAdProfile(client);
  if (!own.profileId) return own;
  const id = form.get("campaign_id");
  if (!isProfileId(id)) return { error: failed };
  const { data: campaign, error } = await client
    .from("company_ad_campaigns")
    .select("id,status")
    .eq("id", id)
    .eq("profile_id", own.profileId)
    .maybeSingle();
  if (error || !campaign || !["draft", "rejected"].includes(campaign.status))
    return { error: "Diese Kampagne kann derzeit nicht bearbeitet werden." };
  const type = form.get("file_type"),
    size = Number(form.get("file_size"));
  const ext =
    type === "image/jpeg"
      ? "jpg"
      : type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : null;
  if (!ext || !Number.isSafeInteger(size) || size <= 0 || size > 5242880)
    return { error: "Bitte wählen Sie JPEG, PNG oder WebP mit maximal 5 MB." };
  return {
    uploadPath: `campaigns/${id}/creative/${crypto.randomUUID()}.${ext}`,
  };
}
export async function saveOwnAd(
  client: SupabaseClient,
  form: FormData,
): Promise<AdFormState & { unauthenticated?: boolean }> {
  const own = await ownAdProfile(client);
  if (!own.profileId) return own;
  const id = form.get("campaign_id"),
    submit = form.get("intent") === "submit";
  if (!isProfileId(id)) return { error: failed };
  const values = validateAdValues(form);
  if (!values.data) return { error: values.error };
  const { data: campaign, error } = await client
    .from("company_ad_campaigns")
    .select("id,status,image_path")
    .eq("id", id)
    .eq("profile_id", own.profileId)
    .maybeSingle();
  if (error || !campaign || !["draft", "rejected"].includes(campaign.status))
    return { error: "Diese Kampagne kann derzeit nicht bearbeitet werden." };
  // Existing media comes from the authorized row, never an arbitrary hidden field.
  values.data.image_path = campaign.image_path;
  let file = form.get("image");
  let uploaded: string | undefined;
  const uploadedPath = form.get("uploaded_path");
  if (typeof uploadedPath === "string") {
    const prefix = `campaigns/${id}/creative/`;
    if (
      !uploadedPath.startsWith(prefix) ||
      !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(uploadedPath.slice(prefix.length))
    )
      return { error: "Das Bild gehört nicht zu dieser Kampagne." };
    const downloaded = await client.storage
      .from(AD_BUCKET)
      .download(uploadedPath);
    if (downloaded.error || !downloaded.data)
      return { error: "Das hochgeladene Bild konnte nicht geprüft werden." };
    // Actual stored bytes and MIME are checked on the server, not browser metadata.
    file = new File([downloaded.data], "upload", {
      type: downloaded.data.type,
    });
    uploaded = uploadedPath;
  }
  if (file instanceof File && file.name && file.size === 0)
    return { error: "Bitte wählen Sie eine nicht leere Bilddatei." };
  if (file instanceof File && file.size > 0) {
    const validated = await validateMediaFile(file);
    if (!validated.file || !validated.extension) {
      if (uploaded) await client.storage.from(AD_BUCKET).remove([uploaded]);
      return { error: validated.error };
    }
    if (uploaded && !uploaded.endsWith("." + validated.extension)) {
      await client.storage.from(AD_BUCKET).remove([uploaded]);
      return { error: "Dateiformat und Upload-Pfad stimmen nicht überein." };
    }
    const path =
      uploaded ??
      `campaigns/${id}/creative/${crypto.randomUUID()}.${validated.extension}`;
    const result = uploaded
      ? { error: null }
      : await client.storage.from(AD_BUCKET).upload(path, validated.file, {
          contentType: validated.file.type,
          upsert: false,
        });
    if (result.error)
      return { error: "Das Bild konnte nicht hochgeladen werden." };
    uploaded = path;
    values.data.image_path = uploaded;
  }
  if (submit && !values.data.image_path)
    return {
      error: "Bitte laden Sie vor dem Einreichen ein Anzeigenbild hoch.",
    };
  const saved = await client.rpc("save_ad_campaign", {
    p_campaign_id: id,
    p_data: values.data,
    p_submit: submit,
  });
  if (saved.error) {
    if (uploaded) await client.storage.from(AD_BUCKET).remove([uploaded]);
    return { error: failed };
  }
  // Old media is unreferenced now. It can be removed while the campaign is still editable.
  if (uploaded && campaign.image_path && !submit)
    await client.storage.from(AD_BUCKET).remove([campaign.image_path]);
  return {
    success: submit
      ? "Ihre Werbekampagne wurde zur Prüfung eingereicht."
      : "Der Entwurf wurde gespeichert.",
  };
}
export async function decideAd(
  client: SupabaseClient,
  form: FormData,
): Promise<AdFormState & { access?: Awaited<ReturnType<typeof checkAdmin>> }> {
  const access = await checkAdmin(client);
  if (access !== "admin") return { access };
  const id = form.get("campaign_id"),
    decision = form.get("decision"),
    note = String(form.get("admin_note") ?? "").trim();
  if (
    !isProfileId(id) ||
    !["approve", "reject", "pause", "resume"].includes(String(decision)) ||
    note.length > 2000
  )
    return {
      error: "Bitte prüfen Sie die Aktion und Ihre Notiz (max. 2000 Zeichen).",
      access,
    };
  const start = String(form.get("approved_start_date") ?? ""),
    end = String(form.get("approved_end_date") ?? "");
  if (
    decision === "approve" &&
    (!validAdDate(start) || !validAdDate(end) || end < start)
  )
    return {
      error: "Bitte geben Sie einen gültigen bestätigten Zeitraum ein.",
      access,
    };
  const { error } = await client.rpc("review_ad_campaign", {
    p_campaign_id: id,
    p_decision: decision,
    p_start: decision === "approve" ? start : null,
    p_end: decision === "approve" ? end : null,
    p_note: note || null,
  });
  if (error)
    return {
      access,
      error: error.message?.includes("ad_booking_conflict")
        ? "Dieser Werbeplatz ist im gewählten Zeitraum bereits belegt. Bitte wählen Sie einen anderen Zeitraum; bei Reaktivierung muss der bestätigte Zeitraum frei sein."
        : "Die Entscheidung konnte nicht gespeichert werden. Bitte laden Sie die Seite neu und prüfen Sie den Kampagnenstatus.",
    };
  return { access, success: "Die Entscheidung wurde gespeichert." };
}
