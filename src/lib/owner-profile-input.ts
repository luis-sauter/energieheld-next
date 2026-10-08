import type { SupabaseClient } from "@supabase/supabase-js";
import type { TravelTerm } from "./admin-travel-taxonomy";
import { audiencePresentation } from "./travel-presentation";
import { loadCompanyDashboard } from "./company-dashboard";

export function ownerTravelTerm(term: TravelTerm) {
  return term.dimension === "theme" || term.dimension === "accommodation" ||
    (term.dimension === "audience" && term.term_key.slice(9) in audiencePresentation);
}
export async function loadOwnerTravelInput(client: SupabaseClient, profileId: string) {
  const [terms, assignments] = await Promise.all([
    client.from("travel_terms").select("term_key,dimension,label").order("dimension").order("label"),
    client.from("company_profile_travel_proposals").select("term_key").eq("profile_id", profileId),
  ]);
  if (terms.error || assignments.error) return { error: "Ihre Reisevorschläge konnten nicht geladen werden. Bitte laden Sie die Seite neu." };
  return { terms: ((terms.data ?? []) as TravelTerm[]).filter(ownerTravelTerm),
    proposedKeys: (assignments.data ?? []).map(row => row.term_key as string) };
}
export async function loadEditorialNote(client: SupabaseClient, profileId: string) {
  const { data, error } = await client.from("company_profile_editorial_notes")
    .select("owner_note").eq("profile_id", profileId).maybeSingle();
  return error ? { error: "Die Hinweise konnten nicht geladen werden." } : { note: (data?.owner_note as string | null) ?? "" };
}
export async function saveOwnEditorialNote(client: SupabaseClient, form: FormData) {
  const dashboard = await loadCompanyDashboard(client);
  if (!dashboard.authenticated) return { error: "Bitte melden Sie sich erneut an." };
  if (dashboard.error || !dashboard.profile) return { error: "Ihr eigenes Profil konnte nicht geladen werden." };
  const raw = form.get("owner_note");
  if (typeof raw !== "string" || raw.length > 4000) return { error: "Die Hinweise dürfen maximal 4.000 Zeichen enthalten." };
  const { error } = await client.from("company_profile_editorial_notes")
    .upsert({ profile_id: dashboard.profile.id, owner_note: raw.trim() || null }, { onConflict: "profile_id" });
  return error ? { error: "Ihre Hinweise konnten nicht gespeichert werden. Bitte versuchen Sie es erneut." }
    : { success: "Ihre Hinweise wurden gespeichert." };
}
