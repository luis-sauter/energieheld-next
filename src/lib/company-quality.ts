import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAdmin, isProfileId, type ReviewResult } from "./admin-review";
export async function loadQualityRequestQueue(client: SupabaseClient) {
  if ((await checkAdmin(client)) !== "admin") return { requests: [] };
  const { data, error } = await client
    .from("company_quality_requests")
    .select("profile_id,requested_at,company_profiles!inner(display_name)")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  return {
    requests: data ?? [],
    error: error
      ? "Verifizierungsanfragen konnten gerade nicht geladen werden."
      : undefined,
  };
}
export async function changeQualityReview(
  client: SupabaseClient,
  form: FormData,
): Promise<ReviewResult> {
  const access = await checkAdmin(client);
  if (access !== "admin") return { access };
  const id = form.get("profile_id"),
    intent = form.get("intent"),
    note = form.get("public_note");
  if (
    !isProfileId(id) ||
    !["verify", "remove", "reject"].includes(String(intent))
  )
    return {
      access,
      error: "Bitte wählen Sie eine gültige Verifizierungsaktion.",
    };
  if (
    intent === "verify" &&
    note !== null &&
    (typeof note !== "string" || note.trim().length > 1000)
  )
    return {
      access,
      error: "Die öffentliche Notiz darf höchstens 1000 Zeichen enthalten.",
    };
  try {
    const { error } =
      intent === "verify"
        ? await client.rpc("verify_company_profile", {
            p_profile_id: id,
            p_public_note:
              typeof note === "string" ? note.trim() || null : null,
          })
        : await client.rpc(
            intent === "reject"
              ? "reject_company_verification_request"
              : "remove_company_verification",
            { p_profile_id: id },
          );
    if (error)
      return {
        access,
        error:
          "Die Verifizierung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
      };
    return {
      access,
      success:
        intent === "verify"
          ? "Die persönliche Verifizierung wurde gespeichert."
          : intent === "reject"
            ? "Die Verifizierungsanfrage wurde abgelehnt."
            : "Die persönliche Verifizierung wurde entfernt.",
    };
  } catch {
    return {
      access,
      error: "Die Verifizierung konnte gerade nicht gespeichert werden.",
    };
  }
}
