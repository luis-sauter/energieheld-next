import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId, type AdminAccess } from "./admin-review";
import { profileFields, validateProfile, type ProfileFormState } from "./company-profile";

export type AdminProfileResult = ProfileFormState & { access: AdminAccess };

export async function updateAdminCompanyProfile(
  supabase: SupabaseClient,
  profileId: unknown,
  form: FormData,
): Promise<AdminProfileResult> {
  const access = await checkAdmin(supabase);
  if (access !== "admin") return { access };
  if (!isProfileId(profileId))
    return { access, error: "Das Firmenprofil wurde nicht gefunden." };

  const { values, error } = validateProfile(form);
  if (error) return { access, error };

  const { data: profile, error: readError } = await supabase
    .from("company_profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (readError)
    return {
      access,
      error: "Das Firmenprofil konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
    };
  if (!profile)
    return { access, error: "Das Firmenprofil wurde nicht gefunden." };

  const update = Object.fromEntries(
    profileFields.map((field) => [field, values[field] || null]),
  );
  const { data: saved, error: updateError } = await supabase
    .from("company_profiles")
    .update(update)
    .eq("id", profile.id)
    .select("id")
    .maybeSingle();
  if (updateError)
    return {
      access,
      error: "Das Firmenprofil konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    };
  if (saved?.id !== profile.id)
    return {
      access,
      error: "Das Firmenprofil ist nicht mehr verfügbar. Bitte laden Sie die Seite neu.",
    };
  return { access, success: "Ihre Änderungen wurden gespeichert." };
}
