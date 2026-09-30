import "server-only";
import { createClient } from "./supabase/server";
import { checkAdmin } from "./admin-review";
import { signAdImages } from "./ad-campaigns";
import { berlinToday, adPlacements, type AdCampaign } from "./ad-values";
import { inlineAdContext, matchesInlineAdContext, type InlineBannerOptions } from "./inline-ad-context";
import { prepareInlineBanner, saveInlineBanner, removeInlineBanner } from "../app/(energieheld)/inline-banner-actions";
import { loadBannerPresentations } from "./banner-presentation-loader";
import { presentedBanners } from "./banner-presentation";

export async function loadInlineBannerOptions(path: string): Promise<InlineBannerOptions | undefined> {
  const context = inlineAdContext(path);
  if (!context) return;
  try {
    const client = await createClient();
    if (await checkAdmin(client) !== "admin") return;
    const [loaded, booked, settings] = await Promise.all([
      client.from("company_ad_campaigns").select("*,targets:company_ad_campaign_targets(target_type,category_id,target_key,placement)").order("created_at", { ascending: false }),
      client.rpc("get_ad_slot_availability", { p_start: berlinToday(), p_end: "9999-12-31", p_exclude_campaign_id: null }),
      loadBannerPresentations(client, context),
    ]);
    const today = berlinToday();
    const rows = ((loaded.data ?? []) as AdCampaign[]).filter((row) =>
      row.targets.some((target) => matchesInlineAdContext(target, context)) &&
      ((row.status === "approved" && row.approved_start_date && row.approved_start_date <= today && row.approved_end_date && row.approved_end_date >= today) ||
       (row.is_editorial && row.status !== "approved" && (row.status !== "paused" || (row.approved_end_date && row.approved_end_date >= today)))));
    let signed = rows;
    let mediaError = false;
    try { signed = await signAdImages(client, rows); }
    catch { mediaError = true; }
    const availability: Record<string, string> = {};
    for (const target of booked.data ?? []) if (matchesInlineAdContext(target, context) && Object.hasOwn(adPlacements, target.placement))
      availability[target.placement] = target.status === "approved" ? "Belegt" : availability[target.placement] || "Angefragt";
    const visible = presentedBanners(signed.filter((row) => row.status === "approved"), settings.rows);
    const legacy = visible.filter((row) => row.source === "legacy");
    for (const row of legacy) availability[row.placement] = "Belegt · Bestandsbanner";
    return { label: context.label, banners: [...signed.map((row) => ({ id: row.id,
      placement: row.targets.find((target) => matchesInlineAdContext(target, context))!.placement,
      target_url: row.target_url, imageUrl: row.imageUrl, shared: row.targets.length !== 1,
      source: "campaign" as const, editorial: Boolean(row.is_editorial),
      size: settings.rows.find((setting) => setting.placement === row.targets.find((target) => matchesInlineAdContext(target, context))?.placement)?.size,
    })), ...legacy.map((row) => ({ id: row.id, placement: row.placement, target_url: row.target_url,
      imageUrl: row.imageUrl, shared: false, source: "legacy" as const, size: row.banner_size }))], availability,
      error: loaded.error || booked.error || settings.error || mediaError ? "Banner und Platzbelegung konnten nicht vollständig geladen werden. Bitte laden Sie die Seite neu." : undefined,
      prepare: prepareInlineBanner.bind(null, path), save: saveInlineBanner.bind(null, path), remove: removeInlineBanner.bind(null, path) };
  } catch { return; }
}
