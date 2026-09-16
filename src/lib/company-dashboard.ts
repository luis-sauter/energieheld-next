import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadCompanyDashboard(supabase: SupabaseClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { authenticated: false as const };

  // Ownership comes only from the verified user, never from URL parameters or metadata.
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, legal_name")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (companyError || !company) {
    return {
      authenticated: true as const,
      email: user.email,
      error: companyError
        ? "Ihre Firmendaten konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut."
        : "Zu Ihrem Konto wurde noch keine Firma gefunden. Bitte wenden Sie sich an den Support.",
    };
  }
  const { data: profile, error: profileError } = await supabase
    .from("company_profiles")
    .select(
      "display_name, tagline, description, phone, public_email, website, street, postal_code, city, region, status",
    )
    .eq("company_id", company.id)
    .maybeSingle();
  return {
    authenticated: true as const,
    email: user.email,
    company,
    profile,
    error: profileError
      ? "Ihr Firmenprofil konnte gerade nicht geladen werden. Bitte versuchen Sie es später erneut."
      : !profile
        ? "Ihr Firmenprofil ist noch nicht verfügbar. Bitte versuchen Sie es später erneut."
        : undefined,
  };
}
