import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAccess = "admin" | "unauthenticated" | "forbidden";
export async function checkAdmin(
  supabase: SupabaseClient,
): Promise<AdminAccess> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return "unauthenticated";
    const { data: admin, error: adminError } = await supabase
      .from("portal_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return !adminError && admin?.user_id === user.id ? "admin" : "forbidden";
  } catch {
    return "forbidden";
  }
}

export function isProfileId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export async function loadReviewOverview(supabase: SupabaseClient) {
  const access = await checkAdmin(supabase);
  if (access !== "admin") return { access };
  const [pending, approved, rejected, queue] = await Promise.all([
    supabase
      .from("company_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("company_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("company_profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected"),
    supabase
      .from("company_profiles")
      .select(
        "id, display_name, city, region, submitted_at, companies!inner(legal_name)",
      )
      .eq("status", "pending")
      .order("submitted_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
  ]);
  if ([pending, approved, rejected, queue].some((result) => result.error)) {
    return {
      access,
      error:
        "Die eingereichten Firmenprofile konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.",
    };
  }
  return {
    access,
    counts: {
      pending: pending.count ?? 0,
      approved: approved.count ?? 0,
      rejected: rejected.count ?? 0,
    },
    profiles: queue.data ?? [],
  };
}

export async function loadReviewProfile(
  supabase: SupabaseClient,
  profileId: string,
) {
  const access = await checkAdmin(supabase);
  if (access !== "admin") return { access };
  if (!isProfileId(profileId)) return { access, profile: null };
  const { data, error } = await supabase
    .from("company_profiles")
    .select(
      "id, display_name, status, submitted_at, tagline, description, phone, public_email, website, street, postal_code, city, region, companies!inner(legal_name)",
    )
    .eq("id", profileId)
    .maybeSingle();
  return {
    access,
    profile: data,
    error: error
      ? "Das Firmenprofil konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut."
      : undefined,
  };
}

export type ReviewResult = {
  access: AdminAccess;
  error?: string;
  success?: string;
};

async function reviewProfile(
  supabase: SupabaseClient,
  profileId: string,
  decision: "approved" | "rejected",
): Promise<ReviewResult> {
  const access = await checkAdmin(supabase);
  if (access !== "admin") return { access };
  if (!isProfileId(profileId))
    return { access, error: "Das Firmenprofil wurde nicht gefunden." };
  try {
    const { data, error } = await supabase.rpc("review_company_profile", {
      p_profile_id: profileId,
      p_decision: decision,
    });
    if (error || data !== decision)
      return {
        access,
        error:
          "Die Prüfung konnte nicht abgeschlossen werden. Das Profil wurde möglicherweise bereits geprüft. Bitte laden Sie die Übersicht neu.",
      };
    return {
      access,
      success:
        decision === "approved"
          ? "Das Firmenprofil wurde freigegeben."
          : "Das Firmenprofil wurde zur Überarbeitung zurückgegeben.",
    };
  } catch {
    return {
      access,
      error:
        "Die Prüfung ist gerade nicht erreichbar. Bitte versuchen Sie es erneut.",
    };
  }
}

// Decisions are fixed in separate entry points, never read from form data.
export function approvePendingProfile(
  supabase: SupabaseClient,
  profileId: string,
) {
  return reviewProfile(supabase, profileId, "approved");
}
export function rejectPendingProfile(
  supabase: SupabaseClient,
  profileId: string,
) {
  return reviewProfile(supabase, profileId, "rejected");
}
