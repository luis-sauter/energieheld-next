"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { decideAd } from "@/lib/ad-campaigns";
import { saveOwnAd, prepareAdUpload, loadAdAvailability } from "@/lib/ad-campaigns";
import { checkAdmin, isProfileId } from "@/lib/admin-review";
import { redirect } from "next/navigation";
import type { AdFormState } from "@/lib/ad-values";
import { validateBannerMetadata, saveBannerMetadata, onlyBannerMetadataChanged } from '@/lib/banner-search-metadata';
import type { AdCampaign } from '@/lib/ad-values';
import { changeAdLifecycle, type LifecycleState } from '@/lib/ad-lifecycle';
export async function lifecycleCampaign(_previous: LifecycleState, form: FormData): Promise<LifecycleState> {
  const result = await changeAdLifecycle(await createClient(), form);
  if (result.success) {
    revalidatePath('/', 'layout');
    if (result.redirectTo) redirect(result.redirectTo);
  }
  return result;
}
export async function adminCampaignAvailability(start: string, end: string, campaignId: string) {
  return loadAdAvailability(await createClient(), start, end, campaignId, true);
}
export async function prepareAdminCampaignImage(form: FormData) {
  return prepareAdUpload(await createClient(), form, true);
}
export async function saveAdminCampaign(_previous: AdFormState, form: FormData): Promise<AdFormState> {
  const client = await createClient();
  requireAdminAccess(await checkAdmin(client));
  let result: AdFormState;
  const validated = validateBannerMetadata(form);
  if (!validated.data) return { error: validated.error };
  try {
    const current = await client.from('company_ad_campaigns').select('*,targets:company_ad_campaign_targets(target_type,category_id,target_key,placement)').eq('id', form.get('campaign_id')).maybeSingle();
    if (current.data?.archived_at) return { error: 'Archivierte Kampagnen sind nicht bearbeitbar. Bitte verwenden Sie sie als neuen Entwurf wieder.' };
    if (!current.error && current.data && onlyBannerMetadataChanged(form, current.data as AdCampaign)) {
      const metadata = await saveBannerMetadata(client, form, current.data.id);
      if (metadata.success) revalidatePath('/', 'layout');
      return { success: metadata.success, error: metadata.error };
    }
    result = await saveOwnAd(client, form, true);
  } catch {
    return { error: "Der Banner konnte gerade nicht gespeichert werden." };
  }
  if (result.success) {
    const metadata = await saveBannerMetadata(client, form, String(form.get('campaign_id')));
    if (metadata.error) return { error: `Banner gespeichert. ${metadata.error}` };
    revalidatePath('/', 'layout');
    revalidatePath("/admin/werbung", "layout");
    revalidatePath("/firma/werbung", "layout");
    revalidatePath("/");
    revalidatePath("/unterkuenfte-a-z");
  }
  return result;
}
export async function createAdminCampaign(form: FormData) {
  const client = await createClient();
  requireAdminAccess(await checkAdmin(client));
  const profileId = form.get("profile_id");
  if (!isProfileId(profileId)) redirect("/admin/werbung?fehler=erstellen");
  const { data, error } = await client.rpc("create_admin_ad_campaign", { p_profile_id: profileId });
  if (error || typeof data !== "string") redirect("/admin/werbung?fehler=erstellen");
  revalidatePath("/admin/werbung");
  redirect(`/admin/werbung/${data}`);
}
export async function reviewCampaign(
  _previous: AdFormState,
  form: FormData,
): Promise<AdFormState> {
  const result = await decideAd(await createClient(), form);
  requireAdminAccess(result.access ?? "forbidden");
  if (result.success) {
    revalidatePath("/admin/werbung", "layout");
    revalidatePath("/firma/werbung", "layout");
    revalidatePath("/experten");
    revalidatePath("/gewerke", "layout");
  }
  return { error: result.error, success: result.success };
}
