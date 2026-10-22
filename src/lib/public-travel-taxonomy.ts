import "server-only";
import { cache } from 'react';
import { createPublicClient } from "@/lib/supabase/public";
import type { PublicTravelTerm } from "./reiseportal-filter-options";

type Assignment = { profile_id: string; term_key: string; seasonal_teaser?: string | null };
export type TravelAssignments = Map<string, string[]> & { seasonTeasers?: Map<string, Record<string, string>> };

export async function loadPublicProfileTravelTerms(profileId: string): Promise<PublicTravelTerm[]> {
  const { data, error } = await createPublicClient().from("company_profile_travel_terms")
    .select("term_key,travel_terms(term_key,dimension,slug,label)").eq("profile_id", profileId).order("term_key");
  if (error) throw new Error("Die Reiseinformationen konnten nicht geladen werden.");
  return (data ?? []).flatMap(row => row.travel_terms ?? []) as unknown as PublicTravelTerm[];
}

export const loadPublicTravelTerms = cache(async (): Promise<PublicTravelTerm[]> => {
  const client = createPublicClient();
  const { data, error } = await client.from("travel_terms")
    .select("term_key,dimension,slug,label").order("term_key");
  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) throw new Error("Die Reisefilter konnten nicht geladen werden.");
  return (data ?? []) as PublicTravelTerm[];
});

// null means the prepared migration has not reached the Cloud yet. An empty
// map means it is installed and there are genuinely no matching assignments.
export const loadPublicTravelAssignments = cache(async (): Promise<TravelAssignments | null> => {
  const client = createPublicClient();
  const assignments: TravelAssignments = new Map<string, string[]>();
  assignments.seasonTeasers = new Map();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("company_profile_travel_terms")
      .select("profile_id,term_key,seasonal_teaser")
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
      if (row.seasonal_teaser) {
        const teasers = assignments.seasonTeasers.get(row.profile_id) ?? {};
        teasers[row.term_key] = row.seasonal_teaser;
        assignments.seasonTeasers.set(row.profile_id, teasers);
      }
    }
    if (rows.length < 500) return assignments;
  }
});
