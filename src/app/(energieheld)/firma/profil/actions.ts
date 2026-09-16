"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  updateOwnCompanyProfile,
  type ProfileFormState,
} from "@/lib/company-profile";

export async function saveProfile(
  _previous: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  let result: ProfileFormState;
  try {
    result = await updateOwnCompanyProfile(await createClient(), form);
  } catch {
    return {
      error:
        "Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut.",
    };
  }
  if (result.unauthenticated) redirect("/login");
  if (result.success) {
    revalidatePath("/firma");
    revalidatePath("/firma/profil");
  }
  return result;
}
