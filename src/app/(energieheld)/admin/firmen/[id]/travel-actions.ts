"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin";
import { saveAdminTravelTerms } from "@/lib/admin-travel-taxonomy";

export async function saveTravelTerms(profileId: string, selected: string[], expected: string[], proposals: string[], revision: number) {
  let result;
  try { result = await saveAdminTravelTerms(await createClient(), profileId, selected, expected, proposals, revision); }
  catch { return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." }; }
  requireAdminAccess(result.access);
  if (result.success) revalidatePath("/", "layout");
  return { error: result.error, success: result.success, assignedKeys: result.assignedKeys, revision: result.revision };
}
