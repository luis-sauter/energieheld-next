import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission } from "@/lib/admin";
import type { EditorialTask } from "@/lib/editorial-queue";
import styles from "@/components/admin/admin.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Offene Redaktionsaufgaben",robots:{index:false,follow:false}};
export default async function TasksPage({searchParams}:{searchParams:Promise<{seite?:string;art?:string}>}) {
 const p=await searchParams,client=await createClient();requireAdminAccess(await checkAdmin(client));
 const raw=Number(p.seite),page=Number.isSafeInteger(raw)&&raw>0&&raw<=100000?raw:1,kind=['profile','advertising','verification'].includes(p.art??'')?p.art!:null;
 const {data,error}=await client.rpc('editorial_work_queue',{p_page:page,p_limit:20,p_kind:kind});
 const href=(n:number)=>`/admin/aufgaben?${new URLSearchParams({seite:String(n),...(kind?{art:kind}:{})})}`;
 const count=data?.counts?.[kind==='profile'?'profiles':kind==='advertising'?'advertising':kind==='verification'?'verifications':'total'];
 return <main id="hauptinhalt" className={`container ${styles.page}`}><Link href="/admin">Zur Redaktion</Link><h1>Offene Redaktionsaufgaben</h1>{error||!data?<p role="alert">Die Aufgaben konnten nicht geladen werden.</p>:<><p>{count} offene Aufgaben</p><ul className={styles.workList}>{(data.tasks as EditorialTask[]).map(t=><li key={`${t.kind}:${t.id}`}><div><strong>{t.name}</strong><p>{t.kind==='profile'?'Firmenprofil':t.kind==='advertising'?'Werbeanfrage':'Verifizierung'} · {formatSubmission(t.submitted_at)}</p></div><Link className="button" href={t.href}>Jetzt prüfen</Link></li>)}</ul>{count===0&&<p>Keine offenen Aufgaben in dieser Ansicht.</p>}<nav className={styles.actions}>{page>1&&<Link href={href(page-1)}>Vorherige Seite</Link>}{count>page*20&&<Link href={href(page+1)}>Nächste Seite</Link>}</nav></>}</main>;
}
