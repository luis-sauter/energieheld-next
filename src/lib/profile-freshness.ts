import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentFreshness } from "./content-freshness";
import { freshnessStatus } from "./content-freshness";
export type AdminFreshnessStatuses = Record<string, ReturnType<typeof freshnessStatus>>;

// Only called with an admin-authorized SSR client; RLS remains authoritative.
// Project just the derived status into the directory, never revisions or actors.
export async function loadAdminFreshnessStatuses(client: SupabaseClient, ids: string[]): Promise<AdminFreshnessStatuses | null> {
  if (!ids.length) return {};
  const { data, error } = await client.from("profile_content_freshness")
    .select("profile_id,content_revision,reviewed_revision,reviewed_at")
    .in("profile_id", [...new Set(ids)]);
  if (error) return null;
  const now = new Date();
  return Object.fromEntries((data ?? []).map(row => [row.profile_id, freshnessStatus({
    ...row, content_updated_at: null, content_update_source: null,
  }, now)]));
}
export async function loadAdminProfileFreshness(client: SupabaseClient, id: string): Promise<ContentFreshness | null> {
  const { data, error } = await client.from("profile_content_freshness")
    .select("content_revision,content_updated_at,content_update_source,reviewed_revision,reviewed_at")
    .eq("profile_id", id).maybeSingle();
  return error ? null : data;
}
