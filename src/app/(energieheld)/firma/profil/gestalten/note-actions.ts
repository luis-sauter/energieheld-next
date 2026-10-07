"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveOwnEditorialNote } from "@/lib/owner-profile-input";
export async function saveEditorialNote(_previous: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  try {
    const result = await saveOwnEditorialNote(await createClient(), form);
    if (result.success) revalidatePath("/firma/profil/gestalten");
    return result;
  } catch {
    return { error: "Ihre Hinweise konnten nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  }
}
