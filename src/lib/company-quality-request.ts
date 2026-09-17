import type { SupabaseClient } from "@supabase/supabase-js";

export type QualityRequest = {
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  decided_at: string | null;
};

export function readQualityRequest(value: unknown): QualityRequest | undefined {
  const row = Array.isArray(value) ? value[0] : value;
  if (
    !row ||
    typeof row !== "object" ||
    !["pending", "approved", "rejected"].includes(row.status) ||
    typeof row.requested_at !== "string"
  )
    return undefined;
  return {
    status: row.status,
    requested_at: row.requested_at,
    decided_at: typeof row.decided_at === "string" ? row.decided_at : null,
  };
}

// There is deliberately no form/URL profile ID parameter. The RPC additionally
// verifies ownership in PostgreSQL, even when called directly through the API.
export async function requestOwnVerification(
  client: SupabaseClient,
): Promise<{ unauthenticated?: boolean; error?: string; success?: string }> {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return { unauthenticated: true as const };
  const failure = {
    error:
      "Die Anfrage konnte nicht gespeichert werden. Bitte laden Sie den Firmenbereich neu und versuchen Sie es erneut.",
  };
  try {
    const { data: company, error: companyError } = await client
      .from("companies")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (companyError || !company) return failure;
    const { data: profile, error: profileError } = await client
      .from("company_profiles")
      .select("id")
      .eq("company_id", company.id)
      .maybeSingle();
    if (profileError || !profile) return failure;
    const { error: requestError } = await client.rpc(
      "request_company_verification",
      { p_profile_id: profile.id },
    );
    return requestError
      ? failure
      : {
          success:
            "Ihre Verifizierung wurde angefragt. Das Energieheld-Team prüft Ihre Anfrage.",
        };
  } catch {
    return failure;
  }
}
