import "server-only";
import { createPublicClient } from "./supabase/public";
import { signAdImages } from "./ad-campaigns";
import type { ActiveAd } from "./ad-values";
import { loadBannerPresentations } from "./banner-presentation-loader";
import { presentedBanners } from "./banner-presentation";
import { inlineAdContext } from "./inline-ad-context";
import { defaultSidebarOrder } from "./sidebar-order";
// One anonymous projection query + one batched signing request per page, never per slot.
export async function loadPublicAds(categoryId?: string, page: "directory" | "homepage" | "portal_area" = "directory", targetKey?: string): Promise<ActiveAd[]> {
  try {
    const client = createPublicClient();
    const context = inlineAdContext(page === "homepage" ? "/" : page === "portal_area" ? `/${targetKey}` : "/unterkuenfte-a-z");
    const [{ data, error }, settings] = await Promise.all([client.rpc("get_active_ad_campaigns", {
      p_scope_type: page === "portal_area" ? "portal_area" : page === "homepage" ? "homepage" : categoryId ? "trade" : "experts_directory",
      p_category_id: page === "portal_area" ? targetKey ?? null : categoryId ?? null,
    }), context ? loadBannerPresentations(client, context) : Promise.resolve({ rows: [], error: null })]);
    if (error || !data || settings.error) throw Error("Banner delivery unavailable");
    return presentedBanners(await signAdImages(client, data as ActiveAd[]), settings.rows, context?.path ?? "");
  } catch {
    // Do not resurrect a deleted static fallback when its persisted state is unavailable.
    return ["top_banner", ...defaultSidebarOrder].map((placement) => ({ id: `hidden:${placement}`,
      placement: placement as ActiveAd["placement"], headline: "", body_text: null, target_url: "",
      image_path: null, suppressed: true, source: "hidden" }));
  }
}
