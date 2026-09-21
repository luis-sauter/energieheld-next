import type { SupabaseClient } from "@supabase/supabase-js";
export type LeadState = { error?: string; success?: string };
export const leadStatuses: Record<string, string> = {
  new: "Neu",
  read: "Gelesen",
  done: "Erledigt",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (form: FormData, key: string) =>
  typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
export function validateLead(form: FormData) {
  const values = {
    name: text(form, "name"),
    email: text(form, "email").toLowerCase(),
    phone: text(form, "phone"),
    message: text(form, "message"),
  };
  if (form.get("website"))
    return { error: "Die Anfrage konnte nicht gesendet werden.", values };
  if (form.get("consent") !== "on")
    return {
      error: "Bitte stimmen Sie der Übermittlung Ihrer Angaben zu.",
      values,
    };
  if (!values.name || !values.email || !values.message)
    return {
      error: "Bitte füllen Sie Name, E-Mail und Nachricht aus.",
      values,
    };
  if (
    values.name.length > 120 ||
    values.email.length > 254 ||
    values.phone.length > 50 ||
    values.message.length > 5000
  )
    return {
      error:
        "Bitte beachten Sie die maximalen Feldlängen: Name 120, E-Mail 254, Telefon 50 und Nachricht 5000 Zeichen.",
      values,
    };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    return {
      error: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      values,
    };
  return { values };
}
export async function createLead(
  client: SupabaseClient,
  profileId: string,
  form: FormData,
): Promise<LeadState> {
  const checked = validateLead(form);
  if (checked.error) return { error: checked.error };
  if (!uuid.test(profileId))
    return { error: "Dieses Firmenprofil ist nicht für Anfragen verfügbar." };
  try {
    const { data, error } = await client.rpc("create_company_lead", {
      p_profile_id: profileId,
      p_name: checked.values.name,
      p_email: checked.values.email,
      p_phone: checked.values.phone || null,
      p_message: checked.values.message,
      p_consent: true,
      p_website: "",
    });
    if (error || data !== true)
      return {
        error:
          error?.message === "duplicate_lead"
            ? "Diese Anfrage wurde bereits gespeichert. Bitte warten Sie einige Minuten, bevor Sie dieselbe Nachricht erneut senden."
            : "Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.",
      };
    return {
      success:
        "Ihre Anfrage wurde gespeichert und an das Unternehmen übermittelt. Sie erhalten eine Rückmeldung direkt vom Unternehmen.",
    };
  } catch {
    return {
      error:
        "Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es später erneut.",
    };
  }
}
export type CompanyLead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  created_at: string;
};
export async function ownLeadProfile(client: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return { unauthenticated: true as const };
  const company = await client
    .from("companies")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (company.error || !company.data)
    return { error: "Ihre Firma konnte nicht geladen werden." };
  const profile = await client
    .from("company_profiles")
    .select("id")
    .eq("company_id", company.data.id)
    .maybeSingle();
  if (profile.error || !profile.data)
    return { error: "Ihr Firmenprofil konnte nicht geladen werden." };
  return { profileId: String(profile.data.id) };
}
export async function loadLeads(client: SupabaseClient, page = 1) {
  const own = await ownLeadProfile(client);
  if (!own.profileId) return own;
  const offset = (page - 1) * 25;
  const { data, error, count } = await client
    .from("company_leads")
    .select("id,name,email,phone,message,status,created_at", { count: "exact" })
    .eq("profile_id", own.profileId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + 24);
  if (error)
    return {
      error:
        "Ihre Anfragen konnten gerade nicht geladen werden. Bitte versuchen Sie es später erneut.",
    };
  return { leads: (data ?? []) as CompanyLead[], count: count ?? 0 };
}
export async function updateLeadStatus(
  client: SupabaseClient,
  form: FormData,
): Promise<LeadState & { unauthenticated?: true }> {
  const own = await ownLeadProfile(client);
  if (!own.profileId) return own;
  const id = text(form, "lead_id"),
    status = text(form, "status");
  if (!uuid.test(id) || !["new", "read", "done"].includes(status))
    return { error: "Bitte wählen Sie einen gültigen Anfragestatus." };
  const { data, error } = await client
    .from("company_leads")
    .update({ status })
    .eq("id", id)
    .eq("profile_id", own.profileId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    return {
      error:
        "Der Status konnte nicht geändert werden. Bitte laden Sie die Seite neu.",
    };
  return { success: "Der Status wurde gespeichert." };
}
