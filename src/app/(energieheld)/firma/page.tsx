import { redirect } from "next/navigation";
import Link from "next/link";
import { energieheld } from "@/config/energieheld";
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
  const assignedCategories = energieheld.categories.filter((category) =>
    profile?.company_profile_categories?.some(
      (assignment) => assignment.category_id === category.id,
    ),
  );
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
        {assignedCategories.length > 0 && (
          <section>
            <h2>Öffentliche Gewerke</h2>
            <p>
              {assignedCategories.map((category) => category.name).join(" · ")}
            </p>
            <p>
              Die öffentliche Einordnung wird bei der Prüfung durch Energieheld
              festgelegt.
            </p>
          </section>
        )}
        <Link className="button" href="/firma/profil">
          Profil bearbeiten
        </Link>
        {profile?.company_quality_reviews?.status === "verified" && (
          <p style={{ color: "#285a3b" }}>
            Ihr Unternehmen ist persönlich verifiziert.
          </p>
        )}
        <LogoutButton />
        <Link className="button" href="/firma/anfragen">
          Anfragen
        </Link>
      </div>
    </main>
  );
}
