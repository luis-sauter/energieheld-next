"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { changeOwnCompanyMedia, type MediaState } from "@/lib/company-media";

export async function saveCompanyMedia(
  _previous: MediaState,
  form: FormData,
): Promise<MediaState> {
  let result: MediaState;
  try {
    result = await changeOwnCompanyMedia(await createClient(), form);
  } catch {
    return {
      error:
        "Die Medien konnten gerade nicht geändert werden. Bitte versuchen Sie es erneut.",
    };
  }
  if (result.unauthenticated) redirect("/login");
  if (result.success) {
    revalidatePath("/firma");
    revalidatePath("/firma/profil");
    revalidatePath("/firma/profil/gestalten");
    revalidatePath("/admin", "layout");
    revalidatePath("/experten", "layout");
    revalidatePath("/gewerke", "layout");
  }
  return result;
}
