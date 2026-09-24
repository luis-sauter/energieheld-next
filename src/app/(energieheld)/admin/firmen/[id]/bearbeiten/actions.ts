"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { updateAdminCompanyProfile } from "@/lib/admin-profile";
import type { ProfileFormState } from "@/lib/company-profile";

export async function saveAdminProfile(
  profileId: string,
  _previous: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  let result;
  try {
    result = await updateAdminCompanyProfile(await createClient(), profileId, form);
  } catch {
    return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(result.access);
  if (result.success) {
    revalidatePath("/admin");
    revalidatePath(`/admin/firmen/${profileId}`);
    revalidatePath(`/admin/firmen/${profileId}/bearbeiten`);
    revalidatePath("/firma");
    revalidatePath("/firma/profil");
    revalidatePath("/experten", "layout");
  }
  return { error: result.error, success: result.success };
}
