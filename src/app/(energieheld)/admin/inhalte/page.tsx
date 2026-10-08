import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/admin-review";
import { requireAdminAccess } from "@/lib/admin";
import { loadContentReviewPage } from "@/lib/editorial-workspace";
import { freshnessDate } from "@/lib/content-freshness";
import { FreshnessStatus } from "@/components/admin/freshness-status";
import styles from "@/components/admin/admin.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Redaktionelle Inhaltsprüfung",robots:{index:false,follow:false}};
export default async function ContentReviewPage({searchParams}:{searchParams:Promise<{ansicht?:string;seite?:string}>}){
 const params=await searchParams,client=await createClient();requireAdminAccess(await checkAdmin(client));
 const reviewed=params.ansicht==="geprueft",raw=Number(params.seite),page=Number.isSafeInteger(raw)&&raw>0&&raw<=100000?raw:1;
 const result=await loadContentReviewPage(client,reviewed,page);
 const href=(n:number)=>"/admin/inhalte?"+new URLSearchParams({ansicht:reviewed?"geprueft":"pruefung",seite:String(n)});
 return <main id="hauptinhalt" className={`container ${styles.page}`}><Link href="/admin">Zur Redaktion</Link><h1>Redaktionelle Inhaltsprüfung</h1><p>Prüfen Sie veröffentlichte Profilinhalte. Die öffentliche Freigabe bleibt dabei erhalten.</p>
 <nav className={styles.actions} aria-label="Inhaltsprüfstatus"><Link className="button" href="/admin/inhalte" aria-current={!reviewed?"page":undefined}>Prüfung erforderlich</Link><Link className="button" href="/admin/inhalte?ansicht=geprueft" aria-current={reviewed?"page":undefined}>Bereits geprüft</Link></nav>
 {result.error?<p role="alert">{result.error}</p>:<><p>{result.count} Profile</p>{!result.rows.length?<p className={styles.emptyState}>Keine Profile in dieser Ansicht.</p>:<ul className={styles.workList}>{result.rows.map(row=><li key={row.id}><div><strong>{row.display_name}</strong><p>{row.city||"Ort nicht angegeben"}</p><FreshnessStatus status={row.review_status}/><p>{row.freshness?.reviewed_at?"Zuletzt geprüft: "+freshnessDate(row.freshness.reviewed_at):"Noch keine Prüfung dokumentiert"}{row.freshness?.content_updated_at?" · Letzte Änderung: "+freshnessDate(row.freshness.content_updated_at):""}</p></div><Link className="button" href={`/admin/firmen/${row.id}/vorschau?bearbeiten=1`}>Profil redaktionell bearbeiten</Link></li>)}</ul>}<nav className={styles.actions} aria-label="Inhaltsprüfseiten">{page>1&&<Link href={href(page-1)}>Vorherige Seite</Link>}{(result.count??0)>page*20&&<Link href={href(page+1)}>Nächste Seite</Link>}</nav></>}
 </main>;
}
