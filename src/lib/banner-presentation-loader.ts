import type { SupabaseClient } from "@supabase/supabase-js";
import type { InlineAdContext } from "./inline-ad-context";
import type { BannerPresentation } from "./banner-presentation";

export async function loadBannerPresentations(client: SupabaseClient, context: InlineAdContext) {
  let query = client.from("ad_slot_presentations").select("placement,size,legacy_hidden,legacy_target_url,legacy_placement,display_source")
    .eq("target_type", context.target_type);
  query = context.target_key === null ? query.is("target_key", null) : query.eq("target_key", context.target_key);
  const { data, error } = await query;
  return { rows: (data ?? []) as BannerPresentation[], error };
}
