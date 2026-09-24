"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { changeAdminProfileContent } from "@/lib/admin-profile-content";

export async function saveInlineContent(profileId: string, slug: string, form: FormData) {
  let result;
  try {
    result = await changeAdminProfileContent(await createClient(), profileId, slug, form);
  } catch {
    return { error: "Der Inhalt konnte gerade nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(result.access);
  if (result.success) revalidatePath(`/experten/${slug}`);
  return { error: result.error, success: result.success };
}
