"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { checkInlineProfileTarget } from "@/lib/inline-admin-profile";
import { updateAdminCompanyProfile } from "@/lib/admin-profile";
import { changeAdminCompanyMedia } from "@/lib/admin-company-media";
import type { ProfileFormState } from "@/lib/company-profile";
import type { MediaState } from "@/lib/company-media";

export async function saveInlineProfile(
  profileId: string,
  slug: string,
  form: FormData,
): Promise<ProfileFormState> {
  let target, result;
  try {
    const client = await createClient();
    target = await checkInlineProfileTarget(client, profileId, slug);
    if (target.access === "admin" && !target.error)
      result = await updateAdminCompanyProfile(client, profileId, form);
  } catch {
    return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(target.access);
  if (target.error) return { error: target.error };
  requireAdminAccess(result!.access);
  if (result!.success) revalidatePath(`/experten/${slug}`);
  return { error: result!.error, success: result!.success };
}

export async function saveInlineMedia(
  profileId: string,
  slug: string,
  form: FormData,
): Promise<MediaState> {
  let target, result;
  try {
    const client = await createClient();
    target = await checkInlineProfileTarget(client, profileId, slug);
    if (target.access === "admin" && !target.error)
      result = await changeAdminCompanyMedia(client, profileId, form);
  } catch {
    return { error: "Die Medien konnten gerade nicht geändert werden. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(target.access);
  if (target.error) return { error: target.error };
  requireAdminAccess(result!.access);
  if (result!.success) revalidatePath(`/experten/${slug}`);
  return { uploadPath: result!.uploadPath, error: result!.error, success: result!.success };
}
