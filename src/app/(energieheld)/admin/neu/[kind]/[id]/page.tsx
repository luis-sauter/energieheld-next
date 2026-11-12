import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {checkAdmin,isProfileId} from '@/lib/admin-review';
import {requireAdminAccess} from '@/lib/admin';
import {NewBadgeSettings} from '@/components/admin/new-badge-settings';
import type {BadgeKind} from '@/lib/new-badge';
export const dynamic='force-dynamic';
export const metadata={title:'Neu-Badge verwalten',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{kind:string;id:string}>}){
  const client=await createClient();requireAdminAccess(await checkAdmin(client));
  const {kind,id}=await params;
  if(!['profile','basic','banner'].includes(kind)||!isProfileId(id))notFound();
  return <main id="hauptinhalt" className="container trade-page"><Link href={kind==='banner'?'/admin/werbung':kind==='basic'?`/admin/firmen/basic/${id}`:`/admin/firmen/${id}`}>Zurück zur Verwaltung</Link><h1>Neu-Badge verwalten</h1><NewBadgeSettings kind={kind as BadgeKind} id={id}/></main>;
}
