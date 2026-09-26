import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicTravelTerm } from "./reiseportal-filter-options";

type Assignment = { profile_id: string; term_key: string };

export async function loadPublicTravelTerms(): Promise<PublicTravelTerm[]> {
  const client = createPublicClient();
  const { data, error } = await client.from("travel_terms")
    .select("term_key,dimension,slug,label").order("term_key");
  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) throw new Error("Die Reisefilter konnten nicht geladen werden.");
  return (data ?? []) as PublicTravelTerm[];
}

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
