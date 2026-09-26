import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId } from "@/lib/admin-review";

export type TravelTerm = {
  term_key: string;
  dimension: "theme" | "audience" | "accommodation" | "feature";
  label: string;
};

export async function loadAdminTravelTaxonomy(client: SupabaseClient, profileId: string) {
  const [terms, assignments] = await Promise.all([
    client.from("travel_terms").select("term_key,dimension,label").order("dimension").order("label"),
    client.from("company_profile_travel_terms").select("term_key").eq("profile_id", profileId),
  ]);
  // The editor appears only after the prepared migration has been applied.
  if (terms.error?.code === "PGRST205" || assignments.error?.code === "PGRST205" ||
      terms.error?.code === "42P01" || assignments.error?.code === "42P01") return null;
  if (terms.error || assignments.error) return { error: "Die Reisezuordnungen konnten nicht geladen werden." };
  return {
    terms: (terms.data ?? []) as TravelTerm[],
    assignedKeys: (assignments.data ?? []).map((row) => row.term_key as string),
  };
}

export async function updateAdminTravelTerm(
  client: SupabaseClient, profileId: string, termKey: string, assign: boolean,
) {
  const access = await checkAdmin(client);
  if (access !== "admin") return { access, error: "Nur die Redaktion darf Reisezuordnungen ändern." };
  if (!isProfileId(profileId) || !/^\w[\w-]*:[\w-]+$/.test(termKey) || typeof assign !== "boolean") {
    return { access, error: "Die Reisezuordnung ist ungültig." };
  }
  const [profile, term] = await Promise.all([
    client.from("company_profiles").select("id").eq("id", profileId).maybeSingle(),
    client.from("travel_terms").select("term_key").eq("term_key", termKey).maybeSingle(),
  ]);
  if (profile.error || !profile.data || term.error || !term.data) {
    return { access, error: "Profil oder Reisethema wurde nicht gefunden." };
  }
  const mutation = assign
    ? await client.from("company_profile_travel_terms")
      .upsert({ profile_id: profileId, term_key: termKey }, { onConflict: "profile_id,term_key", ignoreDuplicates: true })
    : await client.from("company_profile_travel_terms")
      .delete().eq("profile_id", profileId).eq("term_key", termKey);
  if (mutation.error) return { access, error: "Die Reisezuordnung konnte nicht gespeichert werden." };
  return { access, success: "Reisezuordnung gespeichert." };
}
