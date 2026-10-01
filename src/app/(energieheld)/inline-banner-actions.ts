"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prepareInlineAdUpload, saveInlineAd, removeInlineAd } from "@/lib/inline-advertising";
import { inlineAdContext } from "@/lib/inline-ad-context";
import { reorderInlineBannerContents } from "@/lib/inline-banner-order";
import type { SidebarSlot } from "@/lib/sidebar-order";

export async function reorderInlineBanners(path: string, sources: SidebarSlot[], expected?: string[]) {
  try {
    const result = await reorderInlineBannerContents(await createClient(), path, sources, expected);
    if (result.success) revalidatePath(path);
    return result;
  } catch { return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." }; }
}

export async function prepareInlineBanner(path: string, form: FormData) {
  try { return await prepareInlineAdUpload(await createClient(), path, form); }
  catch { return { error: "Der Upload konnte nicht vorbereitet werden. Bitte versuchen Sie es erneut." }; }
}

export async function removeInlineBanner(path: string, form: FormData) {
  try {
    const result = await removeInlineAd(await createClient(), path, form);
    if (inlineAdContext(path)) revalidatePath(path);
    return result;
  } catch { return { error: "Entfernen ist gerade nicht möglich. Bitte versuchen Sie es erneut." }; }
}

export async function saveInlineBanner(path: string, form: FormData) {
  try {
    const result = await saveInlineAd(await createClient(), path, form);
    if (inlineAdContext(path)) revalidatePath(path);
    return result;
  } catch { return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." }; }
}
