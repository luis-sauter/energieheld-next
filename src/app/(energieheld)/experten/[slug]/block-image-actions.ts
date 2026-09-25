"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { changeAdminBlockImages } from "@/lib/admin-block-images";

export async function saveInlineBlockImage(profileId: string, slug: string, form: FormData) {
  let result;
  try {
    result = await changeAdminBlockImages(await createClient(), profileId, slug, form);
  } catch {
    return { error: "Der Bildblock konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(result.access);
  if (result.success) {
    revalidatePath(`/experten/${slug}`);
    revalidatePath(`/unterkuenfte/${slug}`);
  }
  return { error: result.error, success: result.success, uploadPath: result.uploadPath };
}
