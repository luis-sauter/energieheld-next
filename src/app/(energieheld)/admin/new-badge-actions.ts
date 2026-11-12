'use server';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {checkAdmin,isProfileId} from '@/lib/admin-review';
import {validBadgeExpiry,type BadgeKind,type NewBadge} from '@/lib/new-badge';
type State={error?:string;success?:string;row?:NewBadge};
export async function saveNewBadge(_previous:State,form:FormData):Promise<State>{
  const client=await createClient();
  if(await checkAdmin(client)!=='admin')return {error:'Keine Berechtigung.'};
  const id=String(form.get('entity_id')??''),kind=String(form.get('kind')??'') as BadgeKind,enabled=form.get('enabled')==='on',expiry=String(form.get('expires_at')??''),revision=Number(form.get('revision'));
  if(!isProfileId(id)||!['profile','banner','basic'].includes(kind)||!Number.isSafeInteger(revision)||revision<0||(enabled&&!validBadgeExpiry(expiry)))return {error:'Bitte wählen Sie ein gültiges Ablaufdatum innerhalb des nächsten Jahres.'};
  const result=await client.rpc('save_editorial_new_badge',{p_kind:kind,p_id:id,p_enabled:enabled,p_expires_at:enabled?expiry:null,p_revision:revision});
  if(result.error||!result.data)return {error:result.error?.code==='40001'?'Die Einstellungen wurden inzwischen geändert. Bitte laden Sie die Seite neu.':'Das Badge konnte nicht gespeichert werden.'};
  revalidatePath('/','layout');
  return {row:result.data as NewBadge,success:enabled?'Neu-Badge mit Ablaufdatum gespeichert.':'Neu-Badge entfernt.'};
}
