import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewProfile } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission, legalName } from "@/lib/admin";
import { profileStatus } from "@/lib/auth";
import { ReviewActions } from "@/components/admin/review-actions";
import styles from "@/components/admin/admin.module.css";

export const metadata = {
  title: "Firmenprofil prüfen",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadReviewProfile(await createClient(), id);
  requireAdminAccess(result.access);
  if (!result.error && !result.profile) notFound();
  const profile = result.profile;
  const fields = profile
    ? [
        ["Firmenname", legalName(profile.companies)],
        ["Öffentlicher Profilname", profile.display_name],
        [
          "Von der Firma angegebene Branchen / Tätigkeitsbereiche",
          profile.business_areas,
        ],
        ["Status", profileStatus(profile.status)],
        ["Einreichungsdatum", formatSubmission(profile.submitted_at)],
        ["Kurzbeschreibung", profile.tagline],
        ["Beschreibung", profile.description],
        ["Telefon", profile.phone],
        ["Öffentliche E-Mail", profile.public_email],
        ["Website", profile.website],
        ["Straße", profile.street],
        ["PLZ", profile.postal_code],
        ["Ort", profile.city],
        ["Region", profile.region],
      ]
    : [];
  return (
    <main id="hauptinhalt" className={`container ${styles.page}`}>
      <Link className="button" href="/admin">
        Zurück zur Übersicht
      </Link>
      <h1>Firmenprofil prüfen</h1>
      {result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        profile && (
          <div className={styles.card}>
            <dl className={styles.details}>
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Nicht angegeben"}</dd>
                </div>
              ))}
            </dl>
            <ReviewActions
              key={profile.id}
              profileId={profile.id}
              status={profile.status}
              initialCategoryIds={profile.company_profile_categories.map(
                (category) => category.category_id,
              )}
            />
          </div>
        )
      )}
    </main>
  );
}
