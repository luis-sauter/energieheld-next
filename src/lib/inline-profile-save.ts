import type { SupabaseClient } from "@supabase/supabase-js";
import { updateAdminCompanyProfile, type AdminProfileResult } from "./admin-profile";
import { profileFields, validateProfile } from "./company-profile";
import { loadAdminProfileFreshness } from "./profile-freshness";
import type { ContentFreshness } from "./content-freshness";
import { checkAdmin } from "./admin-review";

// Compose existing saves without approving a concurrent, unseen content revision.
// Writes are separate transactions; callers must surface partial success honestly.
export async function saveInlineProfileFields(client: SupabaseClient, profileId: string, form: FormData): Promise<AdminProfileResult & { freshness?: ContentFreshness }> {
  if (!form.has("editor_revision")) return updateAdminCompanyProfile(client, profileId, form);
  const access = await checkAdmin(client);
  if (access !== "admin") return { access };
  const expected = Number(form.get("editor_revision"));
  const conflict = { access, error: "Das Profil wurde zwischenzeitlich geändert. Bitte laden Sie den aktuellen Stand neu." };
  if (!Number.isSafeInteger(expected) || expected < 1) return conflict;
  const { values, error } = validateProfile(form);
  if (error) return { access, error };
  const { data: current, error: readError } = await client.from("company_profiles").select(profileFields.join(",")).eq("id", profileId).maybeSingle();
  const before = await loadAdminProfileFreshness(client, profileId);
  if (readError || !current || !before || before.content_revision !== expected) return conflict;
  const changed = profileFields.filter(field => !(field === "country" || field.startsWith("contact_")) || form.has(field))
    .some(field => ((current as unknown as Record<string, string | null>)[field] ?? null) !== (values[field] || null));
  const result = await updateAdminCompanyProfile(client, profileId, form);
  if (!result.success || result.error) return result;
  const after = await loadAdminProfileFreshness(client, profileId);
  if (!after || after.content_revision !== expected + Number(changed) || after.reviewed_at !== before.reviewed_at || after.review_invalidated_at !== before.review_invalidated_at)
    return { access, error: "Profilangaben wurden gespeichert, aber der Prüfstand hat sich geändert. Bitte laden Sie neu; die Prüfentscheidung wurde nicht übernommen." };
  return { ...result, freshness: after };
}
