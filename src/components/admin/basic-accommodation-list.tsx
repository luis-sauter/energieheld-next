import Link from 'next/link';
import type {SupabaseClient} from '@supabase/supabase-js';
import styles from './admin.module.css';
export async function BasicAccommodationList({client,query,cursor}:{client:SupabaseClient;query:string;cursor?:string}){
  let after=null;
  try{if(cursor){if(cursor.length>2048)throw Error('Invalid cursor');after=JSON.parse(cursor);}}catch{return <p role="alert">Ungültige Folgeseite. <Link href="/admin/firmen?ansicht=basic">Erste Seite öffnen</Link></p>;}
  const {data,error}=await client.rpc('admin_basic_accommodations',{p_query:query,p_after:after});
  if(error||!data||!Array.isArray(data.items))return <p role="alert">Die Basic-Unterkünfte konnten nicht geladen werden. Bitte versuchen Sie es erneut.</p>;
  return <><p>{data.total} Basic-Unterkünfte</p><ul className={styles.workList}>{data.items.map((row:{id:string;name:string;city:string|null;country:string|null;visibility:string})=><li key={row.id}><div><strong>{row.name}</strong><span className={styles.importBadge}>Basic</span><p>{[row.city,row.country].filter(Boolean).join(' · ')}</p><p>{row.visibility==='public'?'Öffentlich':'Intern / nicht öffentlich'}</p></div><Link className="button" href={`/admin/firmen/basic/${row.id}`}>Bearbeiten</Link></li>)}</ul>{!data.items.length&&<p>Keine Basic-Unterkünfte gefunden.</p>}<nav className={styles.actions} aria-label="Basic-Seiten">{cursor&&<Link href={`/admin/firmen?${new URLSearchParams({ansicht:'basic',q:query})}`}>Erste Seite</Link>}{data.nextCursor&&<Link href={`/admin/firmen?${new URLSearchParams({ansicht:'basic',q:query,cursor:JSON.stringify(data.nextCursor)})}`}>Nächste Seite</Link>}</nav></>;
}
