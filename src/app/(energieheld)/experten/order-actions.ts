"use server";

import { revalidatePath } from "next/cache";
import { checkAdmin, isProfileId } from "@/lib/admin-review";
import { createClient } from "@/lib/supabase/server";

export async function saveCompanyDirectoryOrder(profileIds: string[]) {
  try {
    const client = await createClient();
    if (await checkAdmin(client) !== "admin")
      return { error: "Sie sind für diese Änderung nicht berechtigt." };
    if (
      !Array.isArray(profileIds) ||
      profileIds.some((id) => !isProfileId(id)) ||
      new Set(profileIds).size !== profileIds.length
    )
      return { error: "Die Reihenfolge ist ungültig. Bitte laden Sie die Seite neu." };
    const { error } = await client.rpc("reorder_company_directory_profiles", {
      p_profile_ids: profileIds,
    });
    if (error) {
      return {
        error: "Die Reihenfolge konnte nicht gespeichert werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
      };
    }
    revalidatePath("/experten");
    revalidatePath("/gewerke", "layout");
    return { success: "Die Reihenfolge wurde gespeichert." };
  } catch {
    return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." };
  }
}
