import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId } from "./admin-review";

export type TravelTerm = {
  term_key: string;
  dimension: "theme" | "audience" | "accommodation" | "feature";
  label: string;
};
export type TravelReviewSnapshot = { terms: TravelTerm[]; assignedKeys: string[]; proposedKeys: string[]; revision?: number };
export type TravelSaveResult = { error?: string; success?: string; assignedKeys?: string[]; revision?: number };

export async function loadAdminTravelTaxonomy(client: SupabaseClient, profileId: string): Promise<TravelReviewSnapshot | { error: string }> {
  const failed = { error: "Die Reisezuordnungen konnten nicht geladen werden. Bitte laden Sie die Profilprüfung neu." };
  try {
    const { data, error } = await client.rpc("admin_profile_travel_review", { p_profile_id: profileId });
    if (error || !data || !Array.isArray(data.terms) || !Array.isArray(data.assignedKeys) || !Array.isArray(data.proposedKeys) ||
      data.terms.some((term: TravelTerm) => !term || typeof term.term_key !== "string" || typeof term.label !== "string" || !["theme", "audience", "accommodation", "feature"].includes(term.dimension)) ||
      [...data.assignedKeys, ...data.proposedKeys].some(key => typeof key !== "string")) return failed;
    return { ...data, revision: Number.isSafeInteger(data.revision) && data.revision > 0 ? data.revision : undefined } as TravelReviewSnapshot;
  } catch { return failed; }
}

export async function saveAdminTravelTerms(client: SupabaseClient, profileId: string, selected: string[], expected: string[], proposals: string[], revision: number): Promise<TravelSaveResult & { access: Awaited<ReturnType<typeof checkAdmin>> }> {
  const access = await checkAdmin(client);
  if (access !== "admin") return { access, error: "Nur die Redaktion darf Reisezuordnungen ändern." };
  if (!isProfileId(profileId) || !Number.isSafeInteger(revision) || revision < 1 ||
    [selected, expected, proposals].some(keys => !Array.isArray(keys) || keys.length > 500 || keys.some(key => typeof key !== "string" || !/^(theme|audience|accommodation|feature):[a-z0-9-]+$/.test(key)))) {
    return { access, error: "Die Reiseauswahl ist ungültig. Bitte laden Sie die Profilprüfung neu." };
  }
  const { data, error } = await client.rpc("save_profile_travel_assignments", { p_profile_id: profileId, p_terms: [...new Set(selected)], p_expected_terms: expected, p_expected_proposals: proposals, p_expected_revision: revision });
  if (error || !data || !Array.isArray(data.assignedKeys) || !Number.isSafeInteger(data.revision)) return { access, error: "Die Zuordnungen konnten nicht gespeichert werden. Möglicherweise wurde das Profil zwischenzeitlich geändert. Bitte laden Sie die Profilprüfung neu." };
  return { access, success: "Reisezuordnungen gespeichert.", assignedKeys: data.assignedKeys, revision: data.revision };
}
