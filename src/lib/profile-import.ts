import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkAdmin } from './admin-review';
export type ProfileImport = { profile_id: string; source_url: string; imported_at: string; review_note: string };
export async function loadProfileImports(client: SupabaseClient, ids: string[]): Promise<Map<string, ProfileImport>> {
  if (!ids.length || await checkAdmin(client) !== 'admin') return new Map();
  const { data, error } = await client.from('company_profile_imports').select('profile_id,source_url,imported_at,review_note').in('profile_id', ids);
  if (error) return new Map();
  return new Map((data ?? []).map((row: ProfileImport) => [row.profile_id, row]));
}
