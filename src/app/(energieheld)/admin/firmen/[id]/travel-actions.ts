"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { updateAdminTravelTerm } from "@/lib/admin-travel-taxonomy";

export async function toggleTravelTerm(profileId: string, termKey: string, assign: boolean) {
  let result;
  try {
    result = await updateAdminTravelTerm(await createClient(), profileId, termKey, assign);
  } catch {
    return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." };
  }
  requireAdminAccess(result.access);
  if (result.success) {
    revalidatePath(`/admin/firmen/${profileId}`);
    revalidatePath("/unterkuenfte-a-z", "page");
    revalidatePath("/mottoreisen", "layout");
  }
  return { error: result.error, success: result.success };
}
