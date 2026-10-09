import type { SupabaseClient } from '@supabase/supabase-js';
// Fail to the previous cleanup path until the additive catalog migration is installed.
// Once installed, Storage's restrictive policy is the final defense even if this check fails.
export async function retainedProfileMedia(client: SupabaseClient, path: string): Promise<boolean> {
    try {
        const result = await client.rpc('media_library_retains_file', { p_bucket: 'company-media', p_path: path });
        return !result.error && result.data === true;
    }
    catch {
        return false;
    }
}
