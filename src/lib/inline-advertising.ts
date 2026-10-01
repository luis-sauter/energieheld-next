import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId } from "./admin-review";
import { prepareAdUpload, saveOwnAd, decideAd, signAdImages } from "./ad-campaigns";
import { adPlacements, adTargetUrl, adTargetFormValue, berlinToday, type AdCampaign, type AdPlacementId } from "./ad-values";
import { inlineAdContext, matchesInlineAdContext, type InlineBannerResult } from "./inline-ad-context";
import { bannerSizes, legacyCreative, type BannerSize } from "./banner-presentation";
import { loadBannerPresentations } from "./banner-presentation-loader";

const denied = "Dieses Banner kann auf dieser Seite nicht bearbeitet werden. Bitte laden Sie die Seite neu.";

function sizeValue(form: FormData): BannerSize | null {
  const size = form.get("size") ?? "large";
  return typeof size === "string" && Object.hasOwn(bannerSizes, size) ? size as BannerSize : null;
}
async function authorizedLegacy(client: SupabaseClient, path: string, form: FormData) {
  const context = inlineAdContext(path);
  if (!context || await checkAdmin(client) !== "admin") return { error: "Keine Berechtigung." };
  const placement = String(form.get("original_placement") || form.get("placement")) as AdPlacementId;
  if (form.get("placement") !== placement) return { error: "Bitte bearbeiten Sie das Bestandsbanner an seinem bisherigen Platz." };
  const [settings, active] = await Promise.all([loadBannerPresentations(client, context),
    client.rpc("get_active_ad_campaigns", { p_scope_type: context.target_type, p_category_id: context.target_key })]);
  if (settings.error || active.error || settings.rows.some((row) => row.placement === placement && row.legacy_hidden) ||
    (active.data ?? []).some((row: { placement: string }) => row.placement === placement)) return { error: denied };
  const setting = settings.rows.find((row) => row.placement === placement);
  const legacy = legacyCreative(placement, setting?.legacy_placement ?? placement);
  if (!legacy || legacy.id !== form.get("legacy_id")) return { error: denied };
  return { context, legacy: { ...legacy, target_url: setting?.legacy_target_url || legacy.target_url, banner_size: setting?.size } };
}
async function savePresentation(client: SupabaseClient, path: string, placement: AdPlacementId,
  id: string | null, size: BannerSize, hidden = true, url: string | null = null) {
  const context = inlineAdContext(path)!;
  return client.rpc("save_inline_ad_presentation", { p_target_type: context.target_type, p_target_key: context.target_key,
    p_placement: placement, p_campaign_id: id, p_size: size, p_legacy_hidden: hidden, p_legacy_url: url });
}

async function authorizedCampaign(client: SupabaseClient, path: string, form: FormData, requireUrl = true) {
  const context = inlineAdContext(path);
  if (!context || await checkAdmin(client) !== "admin") return { error: "Keine Berechtigung." };
  const placement = form.get("placement");
  if (typeof placement !== "string" || !Object.hasOwn(adPlacements, placement)) return { error: "Bitte wählen Sie einen gültigen Bannerplatz." };
  if (requireUrl && !adTargetUrl(String(form.get("target_url") ?? "").trim())) return { error: "Bitte geben Sie eine gültige Ziel-URL mit https:// oder http:// ein." };
  const id = form.get("campaign_id");
  if (!isProfileId(id)) return { error: denied };
  const { data, error } = await client.from("company_ad_campaigns")
    .select("*,targets:company_ad_campaign_targets(target_type,category_id,target_key,placement)")
    .eq("id", id).maybeSingle();
  const campaign = data as AdCampaign | null;
  if (error || !campaign || !campaign.targets.some((target) => matchesInlineAdContext(target, context))) return { error: denied };
  // A shared creative must be edited deliberately in campaign management, never affect sibling pages silently.
  if (campaign.targets.length !== 1) return { error: "Dieses Banner wird in mehreren Bereichen verwendet. Bitte bearbeiten Sie es in der bestehenden Kampagnenverwaltung." };
  return { context, campaign, placement: placement as AdPlacementId };
}

export async function prepareInlineAdUpload(client: SupabaseClient, path: string, form: FormData): Promise<InlineBannerResult> {
  if (form.get("legacy_id")) {
    const legacy = await authorizedLegacy(client, path, form);
    if (!legacy.legacy) return { error: legacy.error };
  }
  if (!form.get("campaign_id")) {
    const context = inlineAdContext(path);
    if (!context || await checkAdmin(client) !== "admin") return { error: "Keine Berechtigung." };
    const placement = form.get("placement"), type = form.get("file_type"), size = Number(form.get("file_size"));
    if (typeof placement !== "string" || !Object.hasOwn(adPlacements, placement) ||
      !adTargetUrl(String(form.get("target_url") ?? "").trim())) return { error: "Bitte prüfen Sie Bannerplatz und Ziel-URL." };
    if (!["image/jpeg", "image/png", "image/webp"].includes(String(type)) || !Number.isSafeInteger(size) || size <= 0 || size > 5242880)
      return { error: "Bitte wählen Sie JPEG, PNG oder WebP mit maximal 5 MB." };
    const created = await client.rpc("create_editorial_ad_campaign", {
      p_target_type: context.target_type, p_target_key: context.target_key, p_placement: placement,
    });
    if (created.error || !isProfileId(created.data)) return { error: "Das Banner konnte nicht angelegt werden." };
    form.set("campaign_id", created.data);
  }
  const bound = await authorizedCampaign(client, path, form);
  if (!bound.campaign) return { error: bound.error };
  const result = await prepareAdUpload(client, form, true);
  return { ...result, campaignId: bound.campaign.id };
}

export async function saveInlineAd(client: SupabaseClient, path: string, input: FormData): Promise<InlineBannerResult> {
  const size = sizeValue(input);
  if (!size) return { error: "Bitte wählen Sie Klein, Mittel oder Groß." };
  if (!input.get("campaign_id") && input.get("legacy_id")) {
    const bound = await authorizedLegacy(client, path, input);
    if (!bound.legacy) return { error: bound.error };
    const url = adTargetUrl(String(input.get("target_url") ?? "").trim());
    if (!url) return { error: "Bitte geben Sie eine gültige Ziel-URL ein." };
    const saved = await savePresentation(client, path, bound.legacy.placement, null, size, false, url);
    return saved.error ? { error: "Das Bestandsbanner konnte nicht gespeichert werden." }
      : { success: "Das Banner wurde gespeichert.", ad: { ...bound.legacy, banner_size: size, target_url: url } };
  }
  if (input.get("legacy_id")) {
    const legacy = await authorizedLegacy(client, path, input);
    if (!legacy.legacy) return { error: legacy.error };
  }
  const bound = await authorizedCampaign(client, path, input);
  if (!bound.campaign || !bound.context || !bound.placement) return { error: bound.error };
  const campaign = bound.campaign;
  const hasImage = Boolean(input.get("uploaded_path") || campaign.image_path);
  if (!hasImage && !(campaign.is_editorial && campaign.status === "draft")) return { error: "Bitte laden Sie ein Bannerbild hoch." };
  const form = new FormData();
  // Preserve company campaign metadata and dates. New editorial banners run from today until explicitly changed.
  const fresh = campaign.is_editorial && !campaign.internal_name;
  const start = fresh ? berlinToday() : campaign.requested_start_date;
  const end = fresh ? "9999-12-31" : campaign.requested_end_date;
  for (const [key, value] of Object.entries({
    campaign_id: campaign.id, internal_name: campaign.internal_name || `Banner · ${bound.context.label}`,
    headline: campaign.headline || "Anzeige", body_text: campaign.body_text || "",
    placement: bound.placement, requested_start_date: start, requested_end_date: end,
    target_url: String(input.get("target_url")).trim(), contact_name: campaign.contact_name || "",
    contact_phone: campaign.contact_phone || "", contact_email: campaign.contact_email || "",
  })) form.set(key, value);
  form.append("targets", adTargetFormValue({ target_type: bound.context.target_type, target_key: bound.context.target_key,
    category_id: null, placement: bound.placement }));
  const uploaded = input.get("uploaded_path");
  if (typeof uploaded === "string") form.set("uploaded_path", uploaded);
  if (hasImage && ["draft", "rejected"].includes(campaign.status)) form.set("intent", "submit");
  const saved = await saveOwnAd(client, form, true);
  if (!saved.success) return { error: saved.error };
  if (hasImage && campaign.status !== "approved") {
    const review = new FormData();
    review.set("campaign_id", campaign.id);
    review.set("decision", campaign.status === "paused" ? "resume" : "approve");
    review.set("approved_start_date", campaign.approved_start_date || start);
    review.set("approved_end_date", campaign.approved_end_date || end);
    const approved = await decideAd(client, review);
    if (!approved.success) return { error: approved.error || "Das Banner ist gespeichert, konnte aber noch nicht veröffentlicht werden." };
  }
  const presentation = await savePresentation(client, path, bound.placement, campaign.id, size);
  if (presentation.error) return { error: "Das Banner ist gespeichert, die Größe konnte aber nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  const originalPlacement = campaign.targets[0].placement;
  if (originalPlacement !== bound.placement || input.get("legacy_id")) {
    const oldPlacement = input.get("legacy_id") ? String(input.get("original_placement")) as AdPlacementId : originalPlacement;
    // No static fallback may reappear at the place which the editor just emptied.
    if (oldPlacement !== bound.placement) {
      const cleared = await savePresentation(client, path, oldPlacement, null, size);
      if (cleared.error) return { error: "Gespeichert. Der bisherige Bannerplatz konnte nicht freigegeben werden. Bitte laden Sie die Seite neu." };
    }
  }
  const current = await client.from("company_ad_campaigns").select("*").eq("id", campaign.id).maybeSingle();
  if (current.error || !current.data) return { error: "Gespeichert. Bitte laden Sie die Seite für die aktuelle Vorschau neu." };
  try {
    const [ad] = await signAdImages(client, [{ ...current.data, placement: bound.placement }]);
    return { success: "Das Banner wurde gespeichert.", ad: { ...ad, banner_size: size, source: "campaign", suppressed: !hasImage } };
  } catch {
    return { error: "Gespeichert. Die Bildvorschau ist gerade nicht verfügbar. Bitte laden Sie die Seite neu." };
  }
}

export async function removeInlineAd(client: SupabaseClient, path: string, form: FormData): Promise<InlineBannerResult> {
  const action = form.get("action");
  if (action !== "image" && action !== "banner") return { error: "Bitte wählen Sie eine gültige Aktion." };
  if (!sizeValue(form)) return { error: "Bitte wählen Sie Klein, Mittel oder Groß." };
  if (form.get("legacy_id") && !form.get("campaign_id")) {
    const bound = await authorizedLegacy(client, path, form);
    if (!bound.legacy) return { error: bound.error };
    if (action === "image") {
      // Keep its URL and slot as an ordinary editorial draft; never copy/delete the shared legacy asset.
      const created = await client.rpc("create_editorial_ad_campaign", { p_target_type: bound.context!.target_type,
        p_target_key: bound.context!.target_key, p_placement: bound.legacy.placement });
      if (created.error || !isProfileId(created.data)) return { error: "Das Bild konnte nicht entfernt werden." };
      form.set("campaign_id", created.data);
      form.set("target_url", bound.legacy.target_url);
      form.set("size", bound.legacy.banner_size ?? "large");
      const saved = await saveInlineAd(client, path, form);
      return saved.success ? { ...saved, success: "Das Bild wurde entfernt. Sie können jederzeit ein neues hinzufügen." } : saved;
    }
    const saved = await savePresentation(client, path, bound.legacy.placement, null, sizeValue(form) ?? "large");
    return saved.error ? { error: "Das Banner konnte nicht entfernt werden." } : { success: "Das Banner wurde entfernt.", removed: true };
  }
  const bound = await authorizedCampaign(client, path, form, false);
  if (!bound.campaign || !bound.context || !bound.placement) return { error: bound.error };
  if (!bound.campaign.is_editorial || bound.campaign.targets[0].placement !== bound.placement) return { error: denied };
  const removed = await client.rpc("remove_inline_ad_banner", { p_campaign_id: bound.campaign.id,
    p_target_type: bound.context.target_type, p_target_key: bound.context.target_key,
    p_placement: bound.placement, p_remove_banner: action === "banner" });
  if (removed.error) return { error: "Das Banner konnte nicht entfernt werden. Bitte laden Sie die Seite neu." };
  let warning: string | undefined;
  // The existing Storage policy only permits deletion of unreferenced, authorized paths.
  const oldPath = removed.data;
  if (typeof oldPath === "string" && oldPath.startsWith(`campaigns/${bound.campaign.id}/creative/`)) {
    try {
      const cleanup = await client.storage.from("ad-media").remove([oldPath]);
      if (cleanup.error) warning = "Entfernt. Die alte Bilddatei konnte noch nicht aufgeräumt werden.";
    } catch { warning = "Entfernt. Die alte Bilddatei konnte noch nicht aufgeräumt werden."; }
  }
  return { success: action === "banner" ? "Das Banner wurde entfernt." : "Das Bild wurde entfernt. Das Banner bleibt ohne Bild öffentlich ausgeblendet.",
    removed: action === "banner", warning,
    ad: action === "image" ? { ...bound.campaign, image_path: null, imageUrl: undefined,
      placement: bound.placement, source: "campaign", suppressed: true, banner_size: sizeValue(form) ?? "large" } : undefined };
}
