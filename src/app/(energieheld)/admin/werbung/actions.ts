"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { decideAd } from "@/lib/ad-campaigns";
import type { AdFormState } from "@/lib/ad-values";
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
