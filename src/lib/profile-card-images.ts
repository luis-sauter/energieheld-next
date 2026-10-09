import "server-only";
import { createPublicClient } from "./supabase/public";
import { normalizeImageCrop } from "./image-crop";
import type { Listing } from "@/types/portal";

export async function withSavedCardImages(listings: Listing[]): Promise<Listing[]> {
  if (!listings.length) return listings;
  const client = createPublicClient();
  const result = await client.from("company_profile_card_images")
    .select("profile_id,asset_id,bucket_id,storage_path,alt_text,focus_x,focus_y,zoom").in("profile_id", listings.map(row => row.id));
  // Existing public listings remain available before the additive migration.
  if (result.error || !result.data?.length) return listings;
  const rows = result.data;
  const paths = [...new Set(rows.filter(row => row.bucket_id === "company-media").map(row => row.storage_path))];
  const signed = paths.length ? await client.storage.from("company-media").createSignedUrls(paths, 3600) : null;
  const urls = new Map((signed?.data ?? []).filter(row => !row.error && row.signedUrl).map(row => [row.path, row.signedUrl]));
  return listings.map(listing => {
    const row = rows.find(row => row.profile_id === listing.id);
    const src = row?.bucket_id === "project-media" && row.storage_path.startsWith("/reiseportal/") ? row.storage_path : urls.get(row?.storage_path);
    return row && src ? { ...listing, travelImage: { src, alt: row.alt_text || `Unterkunft ${listing.name}` },
      cardImageAssetId: row.asset_id, cardImageCrop: normalizeImageCrop(row) } : listing;
  });
}
