import type { SupabaseClient } from '@supabase/supabase-js';
import { checkAdmin } from './admin-review';
import { validateAdValues, adTargetFormValue, adTargetUrl, type AdCampaign } from './ad-values';

export type BannerSearchMetadata = { name: string; postal_code: string; city: string; term_keys: string[] };
export type BannerSearchTerm = { term_key: string; dimension: string; label: string };
export function onlyBannerMetadataChanged(form: FormData, campaign: AdCampaign) {
  const data = validateAdValues(form).data;
  if (!data || form.get('uploaded_path') || form.get('intent') === 'submit') return false;
  const approved = ['approved', 'paused'].includes(campaign.status);
  const fields = ['internal_name', 'body_text', 'contact_name', 'contact_phone', 'contact_email'] as const;
  return fields.every(key => (data[key] ?? '') === (campaign[key] ?? '')) &&
    data.target_url === adTargetUrl(campaign.target_url) &&
    data.requested_start_date === (approved ? campaign.approved_start_date ?? campaign.requested_start_date : campaign.requested_start_date) &&
    data.requested_end_date === (approved ? campaign.approved_end_date ?? campaign.requested_end_date : campaign.requested_end_date) &&
    JSON.stringify(data.targets.map(adTargetFormValue).sort()) === JSON.stringify(campaign.targets.map(target => adTargetFormValue({ ...target, placement: target.placement ?? campaign.placement })).sort());
}
export function legacyBannerKey(url: string) {
  const target = new URL(url);
  target.hostname = target.hostname.replace(/^www\./, '');
  target.pathname = target.pathname.replace(/\/index\.(php|html?)$/i, '/');
  return `legacy:${target.href}`;
}
export function validateBannerMetadata(form: FormData) {
  const value = (key: string) => typeof form.get(key) === 'string' ? String(form.get(key)).trim() : '';
  const data = { name: value('headline'), postal_code: value('banner_postal_code'), city: value('banner_city'),
    term_keys: [...new Set(form.getAll('banner_terms').map(String))] };
  return !data.name || data.name.length > 100 || data.postal_code.length > 20 || data.city.length > 120 ||
    /[\u0000-\u001f]/.test(data.name + data.postal_code + data.city) || data.term_keys.length > 50 ||
    data.term_keys.some(key => key.length > 160) ? { error: 'Bitte prüfen Sie Name, PLZ, Ort und Kategorien.' } : { data };
}
export async function saveBannerMetadata(client: SupabaseClient, form: FormData, campaignId: string | null, legacyKey: string | null = null) {
  if (await checkAdmin(client) !== 'admin') return { error: 'Keine Berechtigung.' };
  const validated = validateBannerMetadata(form);
  if (!validated.data) return { error: validated.error };
  const { error } = await client.rpc('save_ad_banner_search_metadata', {
    p_campaign_id: campaignId, p_legacy_key: legacyKey, p_name: validated.data.name,
    p_postal_code: validated.data.postal_code, p_city: validated.data.city, p_term_keys: validated.data.term_keys,
  });
  return error ? { error: 'Die Suchdaten konnten nicht gespeichert werden. Bitte prüfen Sie die Kategorien und versuchen Sie es erneut.' }
    : { success: 'Die Suchdaten wurden gespeichert.', metadata: validated.data };
}
export async function loadBannerMetadata(client: SupabaseClient, keys: string[]) {
  const [metadata, assignments, terms] = await Promise.all([
    keys.length ? client.from('ad_banner_search_metadata').select('banner_key,legacy_name,postal_code,city').in('banner_key', keys) : Promise.resolve({ data: [], error: null }),
    keys.length ? client.from('ad_banner_search_terms').select('banner_key,term_key').in('banner_key', keys) : Promise.resolve({ data: [], error: null }),
    client.from('travel_terms').select('term_key,dimension,label').order('dimension').order('label'),
  ]);
  if (metadata.error || assignments.error || terms.error) throw Error('Banner-Suchdaten konnten nicht geladen werden.');
  const values = new Map<string, BannerSearchMetadata>();
  for (const row of metadata.data ?? []) values.set(row.banner_key, { name: row.legacy_name ?? '', postal_code: row.postal_code ?? '', city: row.city ?? '', term_keys: [] });
  for (const row of assignments.data ?? []) values.get(row.banner_key)?.term_keys.push(row.term_key);
  return { values, terms: (terms.data ?? []) as BannerSearchTerm[] };
}
