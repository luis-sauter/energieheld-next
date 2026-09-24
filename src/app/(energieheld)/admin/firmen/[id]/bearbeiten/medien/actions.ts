"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { changeAdminCompanyMedia } from "@/lib/admin-company-media";
import type { MediaState } from "@/lib/company-media";

export async function saveAdminMedia(profileId: string, form: FormData): Promise<MediaState> {
  let result;
  try {
    result = await changeAdminCompanyMedia(await createClient(), profileId, form);
  } catch {
    return { error: "Die Medien konnten gerade nicht geändert werden. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(result.access);
  if (result.success) {
    revalidatePath(`/admin/firmen/${profileId}`);
    revalidatePath(`/admin/firmen/${profileId}/bearbeiten/medien`);
    revalidatePath("/firma/profil/gestalten");
    revalidatePath("/experten", "layout");
    revalidatePath("/gewerke", "layout");
  }
  return { uploadPath: result.uploadPath, error: result.error, success: result.success };
}
