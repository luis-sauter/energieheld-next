"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ownAdProfile, saveOwnAd, prepareAdUpload } from "@/lib/ad-campaigns";
import type { AdFormState } from "@/lib/ad-values";
export async function createCampaign() {
  const client = await createClient();
  const own = await ownAdProfile(client);
  if (own.unauthenticated) redirect("/login");
  if (!own.profileId) redirect("/firma/werbung?fehler=erstellen");
  const { data, error } = await client.rpc("create_ad_campaign");
  if (error || typeof data !== "string")
    redirect("/firma/werbung?fehler=erstellen");
  revalidatePath("/firma/werbung");
  redirect(`/firma/werbung/${data}`);
}
export async function saveCampaign(
  _previous: AdFormState,
  form: FormData,
): Promise<AdFormState> {
  let result: AdFormState & { unauthenticated?: boolean };
  try {
    result = await saveOwnAd(await createClient(), form);
  } catch {
    return { error: "Die Kampagne konnte gerade nicht gespeichert werden." };
  }
  if (result.unauthenticated) redirect("/login");
  if (result.success) {
    revalidatePath("/firma/werbung", "layout");
    revalidatePath("/admin/werbung", "layout");
  }
  return result;
}
export async function prepareCampaignImage(form: FormData) {
  const result = await prepareAdUpload(await createClient(), form);
  if (result.unauthenticated) redirect("/login");
  return result;
}
