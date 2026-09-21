import "server-only";
import { createPublicClient } from "./supabase/public";
import { signAdImages } from "./ad-campaigns";
import type { ActiveAd } from "./ad-values";
// One anonymous projection query + one batched signing request per page, never per slot.
export async function loadPublicAds(categoryId?: string): Promise<ActiveAd[]> {
  try {
    const client = createPublicClient();
    const { data, error } = await client.rpc("get_active_ad_campaigns", {
      p_scope_type: categoryId ? "trade" : "experts_directory",
      p_category_id: categoryId ?? null,
    });
    if (error || !data) return [];
    return (await signAdImages(client, data as ActiveAd[])).filter(
      (ad) => ad.imageUrl,
    );
  } catch {
    return [];
  }
}
