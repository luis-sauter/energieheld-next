import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import { profileStatus } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/auth-form";
import styles from "@/components/auth/auth.module.css";

export const metadata = {
  title: "Firmenbereich",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const dashboard = await loadCompanyDashboard(await createClient());
  if (!dashboard.authenticated) redirect("/login");
  const { company, profile, email, error } = dashboard;
  const location = profile
    ? [profile.postal_code, profile.city, profile.region]
        .filter(Boolean)
        .join(" ")
    : "";
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Ihr Konto</p>
      <h1>Firmenbereich</h1>
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
        <button
          type="button"
          className="button"
          disabled
          aria-describedby="editing-hint"
        >
          Profil bearbeiten
        </button>
        <p id="editing-hint">Die Profilbearbeitung ist demnächst verfügbar.</p>
        <LogoutButton />
      </div>
    </main>
  );
}
