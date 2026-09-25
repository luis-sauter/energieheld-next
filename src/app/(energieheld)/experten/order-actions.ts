"use server";

import { revalidatePath } from "next/cache";
import { checkAdmin, isProfileId } from "@/lib/admin-review";
import { createClient } from "@/lib/supabase/server";
import { listings } from "@/data/listings";
import { isSidebarOrder, type SidebarSlot } from "@/lib/sidebar-order";

const demoKeys = new Set(listings.map((listing) => `demo:${listing.slug}`));

function validDirectoryKeys(value: unknown): value is string[] {
  return Array.isArray(value) && new Set(value).size === value.length &&
    value.every((key) => typeof key === "string" && (
      (key.startsWith("profile:") && isProfileId(key.slice(8))) || demoKeys.has(key)
    ));
}

export async function saveCompanyDirectoryOrder(itemKeys: string[]) {
  try {
    const client = await createClient();
    if (await checkAdmin(client) !== "admin")
      return { error: "Sie sind für diese Änderung nicht berechtigt." };
    if (!validDirectoryKeys(itemKeys))
      return { error: "Die Reihenfolge ist ungültig. Bitte laden Sie die Seite neu." };
    const { error } = await client.rpc("reorder_company_directory_items", {
      p_item_keys: itemKeys,
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

export async function saveSidebarOrder(slots: SidebarSlot[]) {
  try {
    const client = await createClient();
    if (await checkAdmin(client) !== "admin")
      return { error: "Sie sind für diese Änderung nicht berechtigt." };
    if (!isSidebarOrder(slots))
      return { error: "Die Banner-Reihenfolge ist ungültig. Bitte laden Sie die Seite neu." };
    const { error } = await client.rpc("reorder_ad_sidebar_slots", { p_slots: slots });
    if (error) return {
      error: "Die Banner-Reihenfolge konnte nicht gespeichert werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.",
    };
    revalidatePath("/experten");
    revalidatePath("/gewerke", "layout");
    revalidatePath("/");
    return { success: "Die Banner-Reihenfolge wurde gespeichert." };
  } catch {
    return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." };
  }
}
