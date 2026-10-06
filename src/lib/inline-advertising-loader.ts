import "server-only";
import { createClient } from "./supabase/server";
import { checkAdmin } from "./admin-review";
import { signAdImages } from "./ad-campaigns";
import { berlinToday, adPlacements, type AdCampaign } from "./ad-values";
import { inlineAdContext, matchesInlineAdContext, type InlineBannerOptions } from "./inline-ad-context";
import { prepareInlineBanner, saveInlineBanner, removeInlineBanner, reorderInlineBanners, saveInlineBannerMetadata, saveInlineBannerCrop, archiveInlineBanner, reuseInlineBanner } from "../app/(energieheld)/inline-banner-actions";
import { loadBannerPresentations } from "./banner-presentation-loader";
import { displayPlacement, presentedBanners } from "./banner-presentation";
import { loadBannerMetadata, legacyBannerKey } from './banner-search-metadata';
import { legacyBannerPages } from '../data/legacy-banner-pages';

export async function loadInlineBannerOptions(path: string): Promise<InlineBannerOptions | undefined> {
  const context = inlineAdContext(path, true);
  if (!context) return;
  try {
    const client = await createClient();
    if (await checkAdmin(client) !== "admin") return;
    if (!inlineAdContext(path)) {
      const areas = await client.rpc('public_banner_search_contexts');
      if (areas.error || !areas.data?.some((area: { path: string }) => area.path === path)) return;
    }
    const [loaded, booked, settings] = await Promise.all([
      client.from("company_ad_campaigns").select("*,targets:company_ad_campaign_targets(target_type,category_id,target_key,placement)").order("created_at", { ascending: false }),
      client.rpc("get_ad_slot_availability", { p_start: berlinToday(), p_end: "9999-12-31", p_exclude_campaign_id: null }),
      loadBannerPresentations(client, context),
    ]);
    const today = berlinToday();
    const rows = ((loaded.data ?? []) as AdCampaign[]).filter((row) =>
      !row.archived_at &&
      row.targets.some((target) => matchesInlineAdContext(target, context)) &&
      ((row.status === "approved" && row.approved_start_date && row.approved_start_date <= today && row.approved_end_date && row.approved_end_date >= today) ||
       (row.is_editorial && row.status !== "approved" && (row.status !== "paused" || (row.approved_end_date && row.approved_end_date >= today)))));
    let signed = rows;
    let mediaError = false;
    try { signed = await signAdImages(client, rows); }
    catch { mediaError = true; }
    const availability: Record<string, string> = {};
    for (const target of booked.data ?? []) if (matchesInlineAdContext(target, context) && Object.hasOwn(adPlacements, target.placement))
      availability[displayPlacement(target.placement, settings.rows)] = target.status === "approved" ? "Belegt" : availability[displayPlacement(target.placement, settings.rows)] || "Angefragt";
    const pageCampaigns = signed.flatMap((row) => row.targets.filter((target) => matchesInlineAdContext(target, context))
      .map((target) => ({ ...row, placement: target.placement })))
      .sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved"));
    const visible = presentedBanners(pageCampaigns.filter((row) => row.status === "approved"), settings.rows, path);
    const legacy = visible.filter((row) => row.source === "legacy");
    const legacyKey = (id: string) => legacyBannerKey(legacyBannerPages[path].find(row => row.id === id)!.targetUrl);
    const metadata = await loadBannerMetadata(client, [...rows.map(row => `campaign:${row.id}`), ...legacy.map(row => legacyKey(row.id))]);
    for (const row of legacy) availability[row.placement] = "Belegt · Bestandsbanner";
    return { label: context.label, archived: ((loaded.data ?? []) as AdCampaign[]).filter(row => row.archived_at && !row.deletion_requested_at).map(row => ({id:row.id,name:row.headline || row.internal_name || 'Archivierter Banner'})), banners: [...pageCampaigns.map((row) => ({ id: row.id,
      placement: displayPlacement(row.placement, settings.rows),
      target_url: row.target_url, imageUrl: row.imageUrl, shared: row.targets.length !== 1,
      source: "campaign" as const, editorial: Boolean(row.is_editorial),
      metadata: { ...(metadata.values.get(`campaign:${row.id}`) ?? { postal_code: '', city: '', term_keys: [] }), name: row.headline },
      crop: presentedBanners([row], settings.rows, path).find(ad => ad.id === row.id)?.crop,
      size: settings.rows.find((setting) => setting.placement === row.placement)?.size,
    })), ...legacy.map((row) => ({ id: row.id, placement: row.placement, target_url: row.target_url,
      crop: row.crop, mobile_image:row.mobile_image, image_width:row.image_width,image_height:row.image_height, imageUrl: row.imageUrl, shared: false, source: "legacy" as const, size: row.banner_size, legacy_source: row.legacy_source,
      metadata: metadata.values.get(legacyKey(row.id)) ?? { name: row.headline, postal_code: '', city: '', term_keys: [] } }))], availability, terms: metadata.terms,
      error: loaded.error || booked.error || settings.error || mediaError ? "Banner und Platzbelegung konnten nicht vollständig geladen werden. Bitte laden Sie die Seite neu." : undefined,
      prepare: prepareInlineBanner.bind(null, path), save: saveInlineBanner.bind(null, path), remove: removeInlineBanner.bind(null, path),
      saveCrop: saveInlineBannerCrop.bind(null, path),
      saveMetadata: saveInlineBannerMetadata.bind(null, path),
      archive: archiveInlineBanner.bind(null, path), reuse: reuseInlineBanner.bind(null, path),
      reorder: reorderInlineBanners.bind(null, path) };
  } catch { return; }
}
