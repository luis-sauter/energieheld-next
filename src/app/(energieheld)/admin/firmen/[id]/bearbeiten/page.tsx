import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewProfile } from "@/lib/admin-review";
import { requireAdminAccess } from "@/lib/admin";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { ProfileForm } from "@/components/auth/company-profile-form";
import { saveAdminProfile } from "./actions";
import styles from "@/components/auth/auth.module.css";

export const metadata = {
  title: "Firmenprofil redaktionell bearbeiten",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminEditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadReviewProfile(await createClient(), id);
  requireAdminAccess(result.access);
  if (!result.error && !result.profile) notFound();
  const profile = result.profile;
  const values = profile
    ? (Object.fromEntries(
        profileFields.map((field) => [field, profile[field] ?? ""]),
      ) as ProfileValues)
    : null;

  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <p className="eyebrow">Redaktion</p>
      <h1>Firmenprofil bearbeiten</h1>
      <div className={styles.card}>
        {profile && !result.error && (
          <p>
            <Link className="button" href={`/admin/firmen/${profile.id}/bearbeiten/medien`}>
              Logo und Bilder bearbeiten
            </Link>
          </p>
        )}
        {result.error && (
          <p className={styles.error} role="alert">
            {result.error}
          </p>
        )}
        {profile && values && !result.error && (
          <>
            <p>
              Bearbeiten Sie die normalen Profilangaben. Gespeicherte Änderungen
              an veröffentlichten Profilen sind direkt sichtbar.
            </p>
            <ProfileForm
              key={profile.id}
              initialValues={values}
              saveAction={saveAdminProfile.bind(null, profile.id)}
              submitLabel="Änderungen speichern"
              businessAreasHelp="Beschreiben Sie die Tätigkeitsbereiche des Unternehmens. Die weitere Einordnung wird getrennt verwaltet."
            />
          </>
        )}
        <div className={styles.links}>
          <Link href={`/admin/firmen/${id}`}>Zurück zum Firmenprofil</Link>
        </div>
      </div>
    </main>
  );
}
