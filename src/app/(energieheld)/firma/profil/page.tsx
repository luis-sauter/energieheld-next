import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { profileStatus } from "@/lib/auth";
import { CompanyProfileForm } from "@/components/auth/company-profile-form";
import styles from "@/components/auth/auth.module.css";

export const metadata = {
  title: "Firmenprofil bearbeiten",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  const client = await createClient();
  const dashboard = await loadCompanyDashboard(client);
  if (!dashboard.authenticated) redirect("/login");
  const { profile, error } = dashboard;
  const values = profile
    ? (Object.fromEntries(
        profileFields.map((field) => [field, profile[field] ?? ""]),
      ) as ProfileValues)
    : null;
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Ihr Firmenbereich</p>
      <h1>Firmenprofil bearbeiten</h1>
      <div className={styles.card}>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {profile && values && !error && (
          <>
            <p>
              Profilstatus: <strong>{profileStatus(profile.status)}</strong>
            </p>
            <p>
              Schritt 1 von 2: Pflegen Sie Ihre Angaben. Im nächsten Schritt
              gestalten Sie Ihr Profil mit Logo und Bildern. Änderungen an
              veröffentlichten Profilen sind direkt sichtbar.
            </p>
            <CompanyProfileForm initialValues={values} />
          </>
        )}
        <div className={styles.links}>
          <Link href="/firma">Zurück zum Firmenbereich</Link>
        </div>
      </div>
    </main>
  );
}
