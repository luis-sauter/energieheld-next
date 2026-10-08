import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCompanyDashboard } from "@/lib/company-dashboard";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { profileStatus } from "@/lib/auth";
import { CompanyProfileForm } from "@/components/auth/company-profile-form";
import styles from "@/components/auth/auth.module.css";
import { loadOwnerTravelInput } from "@/lib/owner-profile-input";

export const metadata = {
  title: "Angaben zu Ihrer Unterkunft",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  const client = await createClient();
  const dashboard = await loadCompanyDashboard(client);
  if (!dashboard.authenticated) redirect("/login");
  const { profile, error } = dashboard;
  const travel = profile && !error ? await loadOwnerTravelInput(client, profile.id) : null;
  const values = profile
    ? (Object.fromEntries(
        profileFields.map((field) => [field, profile[field] ?? ""]),
      ) as ProfileValues)
    : null;
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Schritt 1 von 2 · Angaben zu Ihrer Unterkunft</p>
      <h1>Angaben zu Ihrer Unterkunft</h1>
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
            <p>Erzählen Sie uns von Ihrer Unterkunft. Tragen Sie die wichtigsten Informationen, Kontaktdaten und besonderen Angebote ein. Diese Angaben bilden die Grundlage für Ihr Profil auf DAS Reiseportal.</p>
            <p>Unsere Redaktion unterstützt Sie bei der Gestaltung Ihres öffentlichen Auftritts. Sie müssen noch keine fertigen Werbetexte oder ein eigenes Layout erstellen.</p>
            {profile.status === "approved" && <p>Änderungen an veröffentlichten Profiltexten und Kontaktdaten sind direkt sichtbar. Reisevorschläge werden separat von der Redaktion geprüft.</p>}
            {travel && ("error" in travel ? <p role="alert">{travel.error}</p> :
              <CompanyProfileForm initialValues={values} travelSelection={{ ...travel, approved: profile.status === "approved" }} />)}
          </>
        )}
        <div className={styles.links}>
          <Link href="/firma">Zurück zum Firmenbereich</Link>
        </div>
      </div>
    </main>
  );
}
