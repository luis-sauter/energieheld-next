import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {BadgeKind,NewBadge} from './new-badge';
import {createPublicClient} from './supabase/public';
export async function loadPublicNewBadges():Promise<NewBadge[]|null> {
  const client=createPublicClient(), rows:NewBadge[]=[];
  for(let offset=0;;offset+=500){
    const result=await client.from('editorial_new_badges').select('kind,entity_id,enabled,starts_at,expires_at,revision').order('kind').order('entity_id').range(offset,offset+499);
    if(result.error) return null;
    rows.push(...result.data as NewBadge[]);
    if(result.data.length<500)return rows;
  }
}
export async function loadAdminNewBadge(client:SupabaseClient,kind:BadgeKind,id:string) {
  const result=await client.from('editorial_new_badges').select('kind,entity_id,enabled,starts_at,expires_at,revision').eq('kind',kind).eq('entity_id',id).maybeSingle();
  return {row:result.data as NewBadge|null,error:Boolean(result.error)};
}
