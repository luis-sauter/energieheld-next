import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

type Assignment = { profile_id: string; term_key: string };

// null means the prepared migration has not reached the Cloud yet. An empty
// map means it is installed and there are genuinely no matching assignments.
export async function loadPublicTravelAssignments(): Promise<Map<string, string[]> | null> {
  const client = createPublicClient();
  const assignments = new Map<string, string[]>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("company_profile_travel_terms")
      .select("profile_id,term_key")
      .order("profile_id").order("term_key")
      .range(offset, offset + 499);
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") return null;
      throw new Error("Die Reisethemen konnten nicht geladen werden.");
    }
    const rows = (data ?? []) as Assignment[];
    for (const row of rows) {
      const terms = assignments.get(row.profile_id) ?? [];
      terms.push(row.term_key);
      assignments.set(row.profile_id, terms);
    }
    if (rows.length < 500) return assignments;
  }
}
