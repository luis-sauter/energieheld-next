import { publicationStatus, importCompanyViews } from '@/lib/profile-publication';
import { MediaCompanyCreate } from "@/components/admin/media-company-create";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminProfileViews, checkAdmin } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission } from "@/lib/admin";
import styles from "@/components/admin/admin.module.css";
import {basicIntegrationEnabled} from '@/lib/basic-public-search';
import {BasicAccommodationList} from '@/components/admin/basic-accommodation-list';
import {BasicWithdrawal} from '@/components/admin/basic-withdrawal';
import {BasicAssessmentFilters} from '@/components/admin/basic-assessment-filters';
export const dynamic = "force-dynamic";
export const metadata = { title: "Firmenverwaltung", robots: { index: false, follow: false } };
type Row = { id: string; display_name: string; legal_name: string; city: string | null; status: string; is_listed: boolean; imported: boolean; slug: string | null; submitted_at: string | null };
export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ ansicht?: string; q?: string; seite?: string; sort?: string;cursor?:string;preisgruppe?:string;quelle?:string;importlauf?:string;regelversion?:string }> }) {
  const params = await searchParams, client = await createClient();
  requireAdminAccess(await checkAdmin(client));
  if(params.ansicht==='basic'&&basicIntegrationEnabled()){
    const priceGroup=['A','B','C','D'].includes(params.preisgruppe??'')?params.preisgruppe!:'';
    const filter={...(params.quelle?{sourceId:params.quelle.slice(0,100)}:{}),...(params.importlauf?{importRun:params.importlauf.slice(0,100)}:{}),...(params.regelversion?{ruleVersion:params.regelversion.slice(0,100)}:{})};
    const withdrawalFilter={...filter,...(priceGroup?{priceGroup}:{})};
    return <main id="hauptinhalt" className={`container ${styles.page}`}><Link href="/admin">Zur Redaktion</Link><h1>Unterkunftsverwaltung · Basic</h1><nav className={styles.actions}><Link className="button" href="/admin/firmen">Unternehmensprofile</Link><Link className="button" aria-current="page" href="/admin/firmen?ansicht=basic">Basic-Unterkünfte</Link></nav>
    <BasicAssessmentFilters query={(params.q??'').trim().slice(0,200)} priceGroup={priceGroup} filter={filter}/>
    <BasicAccommodationList client={client} query={(params.q??'').trim().slice(0,200)} cursor={params.cursor} priceGroup={priceGroup} filter={filter}/>
    {Object.keys(withdrawalFilter).length>0&&<><p>Die Sammelrücknahme berücksichtigt Preisgruppe und Herkunftsfilter, jedoch nicht den Suchbegriff. Die genaue Auswahl wird vor der Bestätigung angezeigt.</p><BasicWithdrawal key={JSON.stringify(withdrawalFilter)} filter={withdrawalFilter}/></>}</main>;
  }
  const views = [...adminProfileViews.map(v => ({...v, filter: v.key === 'veroeffentlicht' ? 'published' : 'all'})), ...importCompanyViews];
  const view = views.find(v => v.key === params.ansicht) ?? views[0];
  const rawPage = Number(params.seite), page = Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 100000 ? rawPage : 1;
  const q = (params.q ?? "").trim().slice(0,200), sort = params.sort === "submitted" ? "submitted" : "name";
  const { data, error } = await client.rpc("editorial_company_page",{ p_status:view.status ?? null, p_query:q,p_page:page,p_sort:sort,p_view:view.filter });
  const href = (next: number) => `/admin/firmen?${new URLSearchParams({ansicht:view.key,q,sort,seite:String(next)})}`;
  return <main id="hauptinhalt" className={`container ${styles.page}`}><Link href="/admin">Zur Redaktion</Link><h1>Firmenverwaltung</h1><MediaCompanyCreate/>{basicIntegrationEnabled()&&<Link className="button" href="/admin/firmen?ansicht=basic">Basic-Unterkünfte verwalten</Link>}
    <nav className={styles.actions} aria-label="Firmenansicht">{views.map(v => <Link className="button" aria-current={view.key === v.key ? "page" : undefined} key={v.key} href={`/admin/firmen?ansicht=${v.key}`}>{v.key === "pruefung" ? "Zur Freischaltung" : v.key === "aenderungen" ? "Rückfragen" : v.key === "alle" ? "Alle Firmen" : v.label}</Link>)}</nav>
    <form className={styles.managementSearch} method="get"><input type="hidden" name="ansicht" value={view.key}/><label>Firmenname, Profilname oder Ort<input name="q" defaultValue={q} maxLength={200} type="search"/></label><label>Sortierung<select name="sort" defaultValue={sort}><option value="name">Profilname</option><option value="submitted">Einreichungsdatum</option></select></label><button className="button" type="submit">Suchen</button></form>
    {error || !data ? <p role="alert">Die Firmenverwaltung konnte nicht geladen werden. Bitte versuchen Sie es erneut.</p> : <><p>{data.count} Firmen in dieser Ansicht</p><ul className={styles.workList}>{(data.profiles as Row[]).map(row => <li key={row.id}><div><strong>{row.display_name}</strong>{row.imported && <span className={styles.importBadge}>Neu importiert</span>}<p>{row.legal_name} · {row.city || "Ort nicht angegeben"}</p><p>{publicationStatus(row.status,row.is_listed)} · {formatSubmission(row.submitted_at)}</p></div><Link className="button" href={row.status === "approved" ? `/admin/firmen/${row.id}/vorschau?bearbeiten=1` : `/admin/firmen/${row.id}`}>{row.status === "approved" ? "Profil bearbeiten" : "Profil prüfen"}</Link>{row.status === "approved" && row.is_listed && row.slug && <Link href={`/unterkuenfte/${row.slug}`}>Öffentliches Profil öffnen</Link>}</li>)}</ul>{!data.profiles.length && <p>Keine Firmen in dieser Ansicht.</p>}<nav className={styles.actions} aria-label="Firmenseiten">{page>1 && <Link href={href(page-1)}>Vorherige Seite</Link>}{data.count>page*20 && <Link href={href(page+1)}>Nächste Seite</Link>}</nav></>}
  </main>;
}
