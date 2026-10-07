import { QualityRequestForm } from "@/components/quality/quality-request-form";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import { profileStatus } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/auth-form";
import styles from "@/components/auth/auth.module.css";
import { analyticsPeriod, loadCompanyMetrics } from "@/lib/dashboard-analytics";
import {
  MetricCards,
  CompanyOverviewMetrics,
} from "@/components/dashboard/metrics";
import dashboardStyles from "@/components/dashboard/dashboard.module.css";
import { CompanyOnboarding } from "@/components/auth/company-onboarding";

export const metadata = {
  title: "Firmenbereich",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CompanyPage({
  searchParams,
}: { searchParams?: Promise<{ zeitraum?: string; willkommen?: string }> } = {}) {
  const params = await searchParams;
  const period = analyticsPeriod(params?.zeitraum);
  const client = await createClient();
  const dashboard = await loadCompanyDashboard(client);
  if (!dashboard.authenticated) redirect("/login");
  const { company, profile, email, error } = dashboard;
  const metrics = profile?.status === "approved" ? await loadCompanyMetrics(client, period) : { data: null, error: null };
  const location = profile
    ? [profile.postal_code, profile.city, profile.region]
        .filter(Boolean)
        .join(" ")
    : "";
  return (
    <main
      id="hauptinhalt"
      className={`container ${styles.page} ${dashboardStyles.page}`}
    >
      <p className="eyebrow">Ihr Konto</p>
      <h1>Firmenbereich</h1>
      {profile && <CompanyOnboarding profile={profile} welcome={params?.willkommen === "1"} />}
      <nav className={dashboardStyles.nav} aria-label="Firmenbereich">
        <Link href="/firma/profil">Profil bearbeiten</Link>
        <Link href="/firma/profil/gestalten">Profil &amp; Bilder gestalten</Link>
        <Link href="/firma/anfragen">Anfragen</Link>
        <Link href="/firma/werbung">Angebotsanfragen</Link>
        <Link href={`/firma/statistiken?zeitraum=${period}`}>Statistiken</Link>
      </nav>
      {profile && (
        <MetricCards
          items={[
            [
              "Profilstatus",
              profile.status === "approved"
                ? "Veröffentlicht"
                : profileStatus(profile.status),
            ],
            [
              "Persönliche Verifizierung",
              profile.company_quality_reviews?.status === "verified"
                ? "Verifiziert"
                : profile.company_quality_requests?.status === "pending"
                  ? "Angefragt"
                  : profile.company_quality_requests?.status === "rejected"
                    ? "Abgelehnt"
                    : "Nicht angefragt",
            ],
          ]}
        />
      )}
      {profile?.status === "approved" && <section className={dashboardStyles.section}>
        <h2>Leistungsüberblick</h2>
        <Link
          className="text-link"
          href={`/firma/statistiken?zeitraum=${period}`}
        >
          Zur ausführlichen Auswertung →
        </Link>
        <p className={dashboardStyles.hint}>
          Die ausführliche Auswertung mit Zeitraumwahl finden Sie unter
          Statistiken. Die Erfassung von Aufrufen und Klicks ist noch nicht
          aktiviert.
        </p>
        {metrics.error && <p role="alert">{metrics.error}</p>}
        {metrics.data && (
          <MetricCards
            items={[["Profilaufrufe", metrics.data.traffic.profile_views]]}
          />
        )}
      </section>}
      {metrics.data && <CompanyOverviewMetrics data={metrics.data} />}
      <div className={styles.card}>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <dl className={styles.details}>
          {company && (
            <>
              <dt>Firmenname</dt>
              <dd>{company.legal_name}</dd>
            </>
          )}
          <dt>Login-E-Mail</dt>
          <dd>{email}</dd>
          {profile && (
            <>
              <dt>Profilstatus</dt>
              <dd>{profileStatus(profile.status)}</dd>
              <dt>Öffentlicher Profilname</dt>
              <dd>{profile.display_name}</dd>
              {location && (
                <>
                  <dt>Standort</dt>
                  <dd>{location}</dd>
                </>
              )}
            </>
          )}
        </dl>
        <Link className="button" href="/firma/profil">
          Profil bearbeiten
        </Link>
        {profile && (
          <section id="verifizierung">
            <h2>Optionale persönliche Verifizierung</h2>
            <p>Diese Qualitätsfunktion ist unabhängig von der ersten Profilfreischaltung.</p>
            <QualityRequestForm
              review={profile.company_quality_reviews}
              request={profile.company_quality_requests}
            />
          </section>
        )}
        <LogoutButton />
        <Link className="button" href="/firma/werbung">
          Angebotsanfragen
        </Link>
        <Link className="button" href="/firma/anfragen">
          Anfragen
        </Link>
      </div>
    </main>
  );
}
