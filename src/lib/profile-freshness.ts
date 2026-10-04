import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentFreshness } from "./content-freshness";
export async function loadAdminProfileFreshness(client: SupabaseClient, id: string): Promise<ContentFreshness | null> {
  const { data, error } = await client.from("profile_content_freshness")
    .select("content_revision,content_updated_at,content_update_source,reviewed_revision,reviewed_at")
    .eq("profile_id", id).maybeSingle();
  return error ? null : data;
}
