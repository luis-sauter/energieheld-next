import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Listing } from "@/types/portal";
import { createPublicClient } from "./supabase/public";

// Never request or serialize the private provenance table for public rendering.
export async function withPublicImportMarkers(
  listings: Listing[],
  client: SupabaseClient = createPublicClient(),
): Promise<Listing[]> {
  const dates = new Map<string, string>();
  const ids = [...new Set(listings.filter(l => !l.isDemo && !l.isPreview).map(l => l.id))];
  const requestedIds = new Set(ids);
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data, error } = await client.rpc("public_company_import_markers", { p_profile_ids: ids.slice(offset, offset + 500) });
    if (error) {
      // Deploy compatibility: profiles remain visible before the additive RPC is applied.
      console.error("Public import markers unavailable.");
      return listings;
    }
    for (const row of data ?? []) {
      if (
        requestedIds.has(row.profile_id) &&
        typeof row.imported_at === "string" &&
        Number.isFinite(Date.parse(row.imported_at))
      ) dates.set(row.profile_id, row.imported_at);
    }
  }
  return listings.map(listing => dates.has(listing.id)
    ? { ...listing, importedAt: dates.get(listing.id) }
    : listing);
}
