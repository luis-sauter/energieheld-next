"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prepareInlineAdUpload, saveInlineAd } from "@/lib/inline-advertising";
import { inlineAdContext } from "@/lib/inline-ad-context";

export async function prepareInlineBanner(path: string, form: FormData) {
  try { return await prepareInlineAdUpload(await createClient(), path, form); }
  catch { return { error: "Der Upload konnte nicht vorbereitet werden. Bitte versuchen Sie es erneut." }; }
}

export async function saveInlineBanner(path: string, form: FormData) {
  try {
    const result = await saveInlineAd(await createClient(), path, form);
    if (inlineAdContext(path)) revalidatePath(path);
    return result;
  } catch { return { error: "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut." }; }
}
