import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId, type AdminAccess } from "./admin-review";

// The route identity is bound on the server; a submitted field cannot retarget it.
export async function checkInlineProfileTarget(
  client: SupabaseClient,
  profileId: unknown,
  slug: unknown,
): Promise<{ access: AdminAccess; error?: string }> {
  const access = await checkAdmin(client);
  if (access !== "admin") return { access };
  if (!isProfileId(profileId) || typeof slug !== "string" || !slug)
    return { access, error: "Das angezeigte Firmenprofil wurde nicht gefunden." };
  const { data, error } = await client.from("company_profiles")
    .select("id")
    .eq("id", profileId)
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();
  if (error || data?.id !== profileId)
    return { access, error: "Das angezeigte Firmenprofil wurde nicht gefunden. Bitte laden Sie die Seite neu." };
  return { access };
}
