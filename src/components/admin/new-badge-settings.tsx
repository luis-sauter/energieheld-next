import {createClient} from '@/lib/supabase/server';
import {checkAdmin} from '@/lib/admin-review';
import {loadAdminNewBadge} from '@/lib/new-badge.server';
import type {BadgeKind} from '@/lib/new-badge';
import {NewBadgeEditor} from './new-badge-editor';
export async function NewBadgeSettings({id,kind}:{id:string;kind:BadgeKind}){
  const client=await createClient();
  if(await checkAdmin(client)!=='admin')return null;
  const {row,error}=await loadAdminNewBadge(client,kind,id);
  // eslint-disable-next-line react-hooks/purity -- Request-time timestamp in this async Server Component, serialized once for hydration.
  return <NewBadgeEditor key={`${kind}:${id}:${row?.revision??0}`} id={id} kind={kind} initial={row} now={Date.now()} error={error}/>;
}
