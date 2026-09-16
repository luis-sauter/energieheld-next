import { signCompanyMedia } from "@/lib/company-media";
import { CompanyMediaForm } from "@/components/auth/company-media-form";
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
  let media;
  if (profile && !error) {
    try {
      media = await signCompanyMedia(client, profile);
    } catch {
      /* Show a neutral retry hint below. */
    }
  }
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
              Änderungen an freigegebenen oder abgelehnten Profilen werden beim
              Speichern als Entwurf übernommen. Reichen Sie das Profil
              anschließend erneut zur Prüfung ein.
            </p>
            <CompanyProfileForm initialValues={values} />
            {media ? (
              <CompanyMediaForm media={media} />
            ) : (
              <p role="alert">
                Die Medien konnten gerade nicht geladen werden. Bitte laden Sie
                die Seite neu.
              </p>
            )}
          </>
        )}
        <div className={styles.links}>
          <Link href="/firma">Zurück zum Firmenbereich</Link>
        </div>
      </div>
    </main>
  );
}
