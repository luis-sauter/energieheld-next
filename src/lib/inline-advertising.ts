import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId } from "./admin-review";
import { prepareAdUpload, saveOwnAd, decideAd, signAdImages } from "./ad-campaigns";
import { adPlacements, adTargetUrl, adTargetFormValue, berlinToday, type AdCampaign, type AdPlacementId } from "./ad-values";
import { inlineAdContext, matchesInlineAdContext, type InlineBannerResult } from "./inline-ad-context";

const denied = "Dieses Banner kann auf dieser Seite nicht bearbeitet werden. Bitte laden Sie die Seite neu.";

async function authorizedCampaign(client: SupabaseClient, path: string, form: FormData) {
  const context = inlineAdContext(path);
  if (!context || await checkAdmin(client) !== "admin") return { error: "Keine Berechtigung." };
  const placement = form.get("placement");
  if (typeof placement !== "string" || !Object.hasOwn(adPlacements, placement)) return { error: "Bitte wählen Sie einen gültigen Bannerplatz." };
  if (!adTargetUrl(String(form.get("target_url") ?? "").trim())) return { error: "Bitte geben Sie eine gültige Ziel-URL mit https:// oder http:// ein." };
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
  const bound = await authorizedCampaign(client, path, input);
  if (!bound.campaign || !bound.context || !bound.placement) return { error: bound.error };
  const campaign = bound.campaign;
  if (!input.get("uploaded_path") && !campaign.image_path) return { error: "Bitte laden Sie ein Bannerbild hoch." };
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
  if (["draft", "rejected"].includes(campaign.status)) form.set("intent", "submit");
  const saved = await saveOwnAd(client, form, true);
  if (!saved.success) return { error: saved.error };
  if (campaign.status !== "approved") {
    const review = new FormData();
    review.set("campaign_id", campaign.id);
    review.set("decision", campaign.status === "paused" ? "resume" : "approve");
    review.set("approved_start_date", campaign.approved_start_date || start);
    review.set("approved_end_date", campaign.approved_end_date || end);
    const approved = await decideAd(client, review);
    if (!approved.success) return { error: approved.error || "Das Banner ist gespeichert, konnte aber noch nicht veröffentlicht werden." };
  }
  const current = await client.from("company_ad_campaigns").select("*").eq("id", campaign.id).maybeSingle();
  if (current.error || !current.data) return { error: "Gespeichert. Bitte laden Sie die Seite für die aktuelle Vorschau neu." };
  try {
    const [ad] = await signAdImages(client, [{ ...current.data, placement: bound.placement }]);
    return { success: "Das Banner wurde gespeichert.", ad };
  } catch {
    return { error: "Gespeichert. Die Bildvorschau ist gerade nicht verfügbar. Bitte laden Sie die Seite neu." };
  }
}
