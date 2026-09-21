import Link from "next/link";
import { loadQualityRequestQueue } from "@/lib/company-quality";
import { createClient } from "@/lib/supabase/server";
import { loadReviewOverview } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission, legalName } from "@/lib/admin";
import styles from "@/components/admin/admin.module.css";
import { analyticsPeriod, loadAdminMetrics } from "@/lib/dashboard-analytics";
import {
  PeriodPicker,
  AdminOverviewMetrics,
} from "@/components/dashboard/metrics";

export const metadata = {
  title: "Adminbereich",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string; zeitraum?: string }>;
}) {
  const params = await searchParams;
  const published = params.ansicht === "veroeffentlicht";
  const period = analyticsPeriod(params.zeitraum);
  const result = await loadReviewOverview(await createClient(), published);
  requireAdminAccess(result.access);
  const client = await createClient();
  const [qualityQueue, metrics] = await Promise.all([
    loadQualityRequestQueue(client),
    loadAdminMetrics(client, period),
  ]);
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Firmen & offizielle Gewerke</p>
      <h1>Adminbereich</h1>
      <PeriodPicker
        period={period}
        base="/admin"
        view={published ? "veroeffentlicht" : undefined}
      />
      <p>
        Statistikzeitraum in Europe/Berlin, einschließlich heute. Das Besucher-
        und Klick-Tracking ist noch nicht aktiviert.
      </p>
      {metrics.error && <p role="alert">{metrics.error}</p>}
      {metrics.data && <AdminOverviewMetrics data={metrics.data} />}
      <Link className="button" href="/admin/werbung">
        Werbekampagnen prüfen
      </Link>
      <p>Erstfreischaltung und Zuordnung zu offiziellen Gewerken.</p>
      <section>
        <h2>Offene Verifizierungsanfragen</h2>
        {qualityQueue.error ? (
          <p role="alert">{qualityQueue.error}</p>
        ) : !qualityQueue.requests.length ? (
          <p>Keine offenen Verifizierungsanfragen.</p>
        ) : (
          <ul className={styles.queue}>
            {qualityQueue.requests.map((request) => {
              const profile = Array.isArray(request.company_profiles)
                ? request.company_profiles[0]
                : request.company_profiles;
              return (
                <li key={request.profile_id} className={styles.card}>
                  <h3>{profile?.display_name}</h3>
                  <p>
                    Verifizierung angefragt am{" "}
                    {formatSubmission(request.requested_at)}
                  </p>
                  <Link
                    className="button"
                    href={`/admin/firmen/${request.profile_id}`}
                  >
                    Verifizierungsanfrage prüfen
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <nav className={styles.actions} aria-label="Firmenansicht">
        <Link className="button" href={`/admin?zeitraum=${period}`}>
          Erstfreischaltungen
        </Link>
        <Link
          className="button"
          href={`/admin?ansicht=veroeffentlicht&zeitraum=${period}`}
        >
          Veröffentlichte Firmen
        </Link>
      </nav>
      {result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        <>
          <dl className={styles.metrics}>
            <div>
              <dt>Zur Prüfung</dt>
              <dd>{result.counts?.pending}</dd>
            </div>
            <div>
              <dt>Freigegeben</dt>
              <dd>{result.counts?.approved}</dd>
            </div>
            <div>
              <dt>Änderungen erforderlich</dt>
              <dd>{result.counts?.rejected}</dd>
            </div>
          </dl>
          <h2>
            {published
              ? "Veröffentlichte Firmen"
              : "Zur erstmaligen Freischaltung"}
          </h2>
          {!result.profiles?.length ? (
            <p>Keine Firmenprofile in dieser Ansicht.</p>
          ) : (
            <ul className={styles.queue}>
              {result.profiles.map((profile) => (
                <li className={styles.card} key={profile.id}>
                  <h3>{legalName(profile.companies)}</h3>
                  <p>Öffentlicher Profilname: {profile.display_name}</p>
                  <p>
                    {[profile.city, profile.region]
                      .filter(Boolean)
                      .join(", ") || "Kein Standort angegeben"}
                  </p>
                  <p>Eingereicht: {formatSubmission(profile.submitted_at)}</p>
                  <Link
                    className="button button-primary"
                    href={`/admin/firmen/${profile.id}`}
                  >
                    {published ? "Gewerke bearbeiten" : "Firma freischalten"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
