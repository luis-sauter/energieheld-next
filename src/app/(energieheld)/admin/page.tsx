import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin, adminProfileViews } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission } from "@/lib/admin";
import { getEditorialQueue } from "@/lib/editorial-queue-server";
import styles from "@/components/admin/admin.module.css";
import { analyticsPeriod, loadAdminMetrics } from "@/lib/dashboard-analytics";
import { PeriodPicker, AdminOverviewMetrics } from "@/components/dashboard/metrics";
export const metadata = { title: "Redaktion", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ ansicht?: string; zeitraum?: string }> }) {
  const params = await searchParams;
  const client = await createClient();
  requireAdminAccess(await checkAdmin(client));
  if (params.ansicht && adminProfileViews.some(view => view.key === params.ansicht)) redirect(`/admin/firmen?ansicht=${params.ansicht}`);
  const period = analyticsPeriod(params.zeitraum);
  const [queue, metrics] = await Promise.all([getEditorialQueue(), loadAdminMetrics(client, period)]);
  return <main id="hauptinhalt" className={`container ${styles.page}`}>
    <header className={styles.reviewHeader}><p className="eyebrow">DAS Reiseportal</p><h1>Redaktion</h1><p>Hier verwalten Sie neue Einreichungen, Werbeanfragen und veröffentlichte Unternehmensprofile.</p></header>
    <section aria-labelledby="tasks-title"><h2 id="tasks-title">Offene Aufgaben</h2>
      {queue.error ? <p role="alert">{queue.error}</p> : <>
        {queue.counts?.total === 0 && <p>Aktuell liegen keine neuen Redaktionsaufgaben vor.</p>}
        <div className={styles.taskGrid}>
          <article className={styles.taskCard}><h3>Firmenprofile prüfen</h3><p>{queue.counts?.profiles} neue Einreichungen</p><Link className="button button-primary" href="/admin/firmen?ansicht=pruefung">Jetzt prüfen</Link></article>
          <article className={styles.taskCard}><h3>Werbeanfragen prüfen</h3><p>{queue.counts?.advertising} offene Angebotsanfragen</p><Link className="button button-primary" href="/admin/werbung?ansicht=pruefung">Jetzt prüfen</Link></article>
        </div>
        {Boolean(queue.counts?.verifications) && <p><Link href="/admin/aufgaben?art=verification">Optionale Verifizierungen ({queue.counts?.verifications})</Link></p>}
      </>}
    </section>
    <section className={styles.reviewSection}><h2>Als Nächstes bearbeiten</h2>
      <ul className={styles.workList}>{queue.tasks.map(task => <li key={`${task.kind}:${task.id}`}><div><strong>{task.name || "Neue Einreichung"}</strong><p>{task.kind === "profile" ? "Firmenprofil" : task.kind === "advertising" ? "Werbeanfrage" : "Verifizierung"} · Zur Prüfung · {formatSubmission(task.submitted_at)}</p></div><Link className="button" href={task.href}>{task.kind === "advertising" ? "Werbung prüfen" : task.kind === "profile" ? "Profil prüfen" : "Verifizierung prüfen"}</Link></li>)}</ul>
      <Link href="/admin/aufgaben">Alle offenen Aufgaben</Link>
    </section>
    <section className={styles.reviewSection}><h2>Verwaltung</h2><nav className={styles.taskGrid} aria-label="Redaktionelle Verwaltung">
      <Link className={styles.taskCard} href="/admin/firmen?ansicht=alle">Alle Firmen verwalten</Link>
      <Link className={styles.taskCard} href="/admin/werbung">Alle Werbekampagnen</Link>
      <Link className={styles.taskCard} href="/unterkuenfte-a-z#inhaltspruefung">Redaktionelle Inhaltsprüfungen</Link>
      <Link className={styles.taskCard} href="/admin/aufgaben?art=verification">Optionale Verifizierungen</Link>
    </nav></section>
    <section className={styles.reviewSection}><h2>Statistiken &amp; Auswertung</h2><PeriodPicker period={period} base="/admin" /><p>Statistikzeitraum in Europe/Berlin, einschließlich heute. Das Besucher- und Klick-Tracking ist noch nicht aktiviert.</p>{metrics.error && <p role="alert">{metrics.error}</p>}{metrics.data && <AdminOverviewMetrics data={metrics.data} />}</section>
  </main>;
}
