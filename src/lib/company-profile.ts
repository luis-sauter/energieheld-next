import type { SupabaseClient } from "@supabase/supabase-js";

export const profileFields = [
  "display_name",
  "business_areas",
  "tagline",
  "description",
  "phone",
  "public_email",
  "website",
  "street",
  "postal_code",
  "city",
  "region",
] as const;
export type ProfileValues = Record<(typeof profileFields)[number], string>;
export type ProfileFormState = {
  error?: string;
  success?: string;
  unauthenticated?: boolean;
};

export function validateProfile(form: FormData) {
  const values = Object.fromEntries(
    profileFields.map((key) => {
      const value = form.get(key);
      return [key, typeof value === "string" ? value.trim() : ""];
    }),
  ) as ProfileValues;
  let error: string | undefined;
  if (!values.display_name)
    error = "Bitte geben Sie einen öffentlichen Profilnamen ein.";
  else if (
    values.public_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.public_email)
  ) {
    error = "Bitte geben Sie eine gültige öffentliche E-Mail-Adresse ein.";
  } else if (values.website) {
    try {
      const url = new URL(values.website);
      if (
        !/^https?:\/\//i.test(values.website) ||
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      ) {
        error =
          "Bitte geben Sie eine gültige Website mit http:// oder https:// ein.";
      }
    } catch {
      error =
        "Bitte geben Sie eine gültige Website mit http:// oder https:// ein.";
    }
  }
  if (!error && values.postal_code && !/^\d{4,5}$/.test(values.postal_code)) {
    error = "Bitte geben Sie eine PLZ mit 4 oder 5 Ziffern ein.";
  }
  return { values, error };
}

export async function updateOwnCompanyProfile(
  supabase: SupabaseClient,
  form: FormData,
): Promise<ProfileFormState> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { unauthenticated: true };
  const { values, error } = validateProfile(form);
  if (error) return { error };
  const intent = form.get("intent");
  if (intent !== "save" && intent !== "submit")
    return { error: "Bitte wählen Sie Speichern oder Zur Prüfung einreichen." };
  if (intent === "submit" && !values.business_areas) {
    return {
      error:
        "Bitte beschreiben Sie Ihre Branchen / Tätigkeitsbereiche, bevor Sie das Profil zur Prüfung einreichen.",
    };
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (companyError || !company)
    return {
      error:
        "Ihre eigene Firma konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
    };
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select("status")
    .eq("company_id", company.id)
    .maybeSingle();
  if (profileError || !profile)
    return {
      error:
        "Ihr Firmenprofil konnte nicht geladen werden. Bitte versuchen Sie es erneut.",
    };
  if (!["draft", "pending", "approved", "rejected"].includes(profile.status)) {
    return { error: "Dieses Profil kann derzeit nicht bearbeitet werden." };
  }

  // Never accept ownership, slug, status or timestamps from form data.
  const status =
    intent === "submit" && profile.status !== "approved"
      ? "pending"
      : profile.status;
  const update = {
    ...Object.fromEntries(
      profileFields.map((key) => [key, values[key] || null]),
    ),
    status,
    ...(intent === "submit" && profile.status !== "approved"
      ? { submitted_at: new Date().toISOString() }
      : status === "draft"
        ? { submitted_at: null }
        : {}),
  };
  // Save fields and submission in one atomic UPDATE. The status predicate also
  // prevents overwriting a concurrent moderation decision with a stale state.
  const { data: updated, error: updateError } = await supabase
    .from("company_profiles")
    .update(update)
    .eq("company_id", company.id)
    .eq("status", profile.status)
    .select("company_id")
    .maybeSingle();
  if (updateError)
    return {
      error:
        "Ihr Profil konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    };
  if (!updated)
    return {
      error:
        "Das Profil wurde zwischenzeitlich geändert oder ist nicht mehr verfügbar. Bitte laden Sie die Seite neu.",
    };
  return {
    success:
      intent === "submit" && profile.status !== "approved"
        ? "Ihr Profil wurde zur erstmaligen Freischaltung eingereicht."
        : "Ihre Änderungen wurden gespeichert.",
  };
}
