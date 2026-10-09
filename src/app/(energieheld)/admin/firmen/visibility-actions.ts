"use server";
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { checkAdmin, isProfileId } from '@/lib/admin-review';
export async function saveProfileVisibility(_previous: {error?:string;success?:string}, form:FormData):Promise<{error?:string;success?:string}> {
  const client = await createClient(), id=String(form.get('profile_id')??''), value=form.get('is_listed');
  if (await checkAdmin(client)!=='admin' || !isProfileId(id) || !['yes','no'].includes(String(value))) return {error:'Keine Berechtigung oder ungültige Auswahl.'};
  const profile=await client.from('company_profiles').select('id').eq('id',id).maybeSingle();
  if (profile.error || !profile.data) return {error:'Profil nicht gefunden.'};
  const saved=await client.from('company_profile_public_visibility').upsert({profile_id:id,is_listed:value==='yes'},{onConflict:'profile_id'});
  if (saved.error) return {error:'Sichtbarkeit konnte nicht gespeichert werden.'};
  revalidatePath('/','layout');
  return {success:value==='yes'?'Profil wieder öffentlich sichtbar.':'Profil ausgeblendet. Verknüpfte Banner bleiben bestehen.'};
}
