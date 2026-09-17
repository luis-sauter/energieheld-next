"use server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { changeQualityReview } from "@/lib/company-quality";
import { revalidatePath } from "next/cache";
export async function saveQualityReview(
  _previous: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const result = await changeQualityReview(await createClient(), form);
  requireAdminAccess(result.access);
  if (result.success) {
    revalidatePath("/admin/firmen/[id]", "page");
    revalidatePath("/experten", "layout");
    revalidatePath("/gewerke", "layout");
    revalidatePath("/firma", "layout");
  }
  return { error: result.error, success: result.success };
}
