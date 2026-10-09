"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin, isProfileId } from "@/lib/admin-review";
import { hasPersistedImageCrop, type ImageCrop } from "@/lib/image-crop";
export async function saveCardImage(profileId: string, assetId: string, crop: ImageCrop): Promise<{ success?: string; error?: string }> {
  const client = await createClient();
  if (await checkAdmin(client) !== "admin") return { error: "Keine Berechtigung." };
  if (!isProfileId(profileId) || !isProfileId(assetId) || !hasPersistedImageCrop(crop)) return { error: "Ungültige Bildauswahl." };
  // The invoker guard derives path/alt from the locked own-company catalog entry.
  // No gallery/media-original updates, no service-role client or public RPC.
  const result = await client.from("company_profile_card_images").upsert({ profile_id: profileId,
    asset_id: assetId, bucket_id: "company-media", storage_path: "", ...crop }, { onConflict: "profile_id" });
  if (result.error) return { error: "Das Kartenbild konnte nicht gespeichert werden. Bitte wählen Sie ein verfügbares Bild dieses Unternehmens." };
  revalidatePath("/", "layout");
  return { success: "Kartenbild gespeichert." };
}
