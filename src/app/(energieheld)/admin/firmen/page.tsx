import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminProfileViews, checkAdmin } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission } from "@/lib/admin";
import { profileStatus } from "@/lib/auth";
import styles from "@/components/admin/admin.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Firmenverwaltung", robots: { index: false, follow: false } };
type Row = { id: string; display_name: string; legal_name: string; city: string | null; status: string; submitted_at: string | null };
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string; seite?: string; sort?: string }> }) {
  const params = await searchParams, client = await createClient();
  requireAdminAccess(await checkAdmin(client));
  const view = adminProfileViews.find(v => v.key === params.ansicht) ?? adminProfileViews[0];
  const rawPage = Number(params.seite), page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const q = (params.q ?? "").trim().slice(0,200), sort = params.sort === "submitted" ? "submitted" : "name";
  const { data, error } = await client.rpc("editorial_company_page",{ p_status:view.status ?? null, p_query:q,p_page:page,p_sort:sort });
  const href = (next: number) => `/admin/firmen?${new URLSearchParams({ansicht:view.key,q,sort,seite:String(next)})}`;
  return <main id="hauptinhalt" className={`container ${styles.page}`}><Link href="/admin">Zur Redaktion</Link><h1>Firmenverwaltung</h1>
    <nav className={styles.actions} aria-label="Firmenansicht">{adminProfileViews.map(v => <Link className="button" aria-current={view.key === v.key ? "page" : undefined} key={v.key} href={`/admin/firmen?ansicht=${v.key}`}>{v.key === "pruefung" ? "Zur Freischaltung" : v.key === "aenderungen" ? "Rückfragen" : v.key === "alle" ? "Alle Firmen" : v.label}</Link>)}</nav>
    <form className={styles.managementSearch} method="get"><input type="hidden" name="ansicht" value={view.key}/><label>Firmenname, Profilname oder Ort<input name="q" defaultValue={q} maxLength={200} type="search"/></label><label>Sortierung<select name="sort" defaultValue={sort}><option value="name">Profilname</option><option value="submitted">Einreichungsdatum</option></select></label><button className="button" type="submit">Suchen</button></form>
    {error || !data ? <p role="alert">Die Firmenverwaltung konnte nicht geladen werden. Bitte versuchen Sie es erneut.</p> : <><p>{data.count} Firmen in dieser Ansicht</p><ul className={styles.workList}>{(data.profiles as Row[]).map(row => <li key={row.id}><div><strong>{row.display_name}</strong><p>{row.legal_name} · {row.city || "Ort nicht angegeben"}</p><p>{profileStatus(row.status)} · {formatSubmission(row.submitted_at)}</p></div><Link className="button" href={row.status === "approved" ? `/admin/firmen/${row.id}/vorschau?bearbeiten=1` : `/admin/firmen/${row.id}`}>{row.status === "approved" ? "Profil bearbeiten" : "Profil prüfen"}</Link></li>)}</ul>{!data.profiles.length && <p>Keine Firmen in dieser Ansicht.</p>}<nav className={styles.actions} aria-label="Firmenseiten">{page>1 && <Link href={href(page-1)}>Vorherige Seite</Link>}{data.count>page*20 && <Link href={href(page+1)}>Nächste Seite</Link>}</nav></>}
  </main>;
}
