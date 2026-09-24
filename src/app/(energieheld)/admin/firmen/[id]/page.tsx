import { signCompanyMedia } from "@/lib/company-media";
import { CompanyImage } from "@/components/portal/company-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewProfile } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission, legalName } from "@/lib/admin";
import { profileStatus } from "@/lib/auth";
import { ReviewActions } from "@/components/admin/review-actions";
import { QualityReviewForm } from "@/components/quality/quality-review-form";
import styles from "@/components/admin/admin.module.css";

export const metadata = {
  title: "Firma & Gewerke",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await createClient();
  const result = await loadReviewProfile(client, id);
  requireAdminAccess(result.access);
  if (!result.error && !result.profile) notFound();
  const profile = result.profile;
  let media;
  if (profile && !result.error) {
    try {
      media = await signCompanyMedia(client, profile);
    } catch {
      /* Media availability does not block category management. */
    }
  }
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
            <div className={styles.actions}>
              <Link
                className="button button-primary"
                href={`/admin/firmen/${profile.id}/bearbeiten`}
              >
                Profil bearbeiten
              </Link>
            </div>
            <dl className={styles.details}>
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Nicht angegeben"}</dd>
                </div>
              ))}
            </dl>
            <section>
              <h2>Firmenlogo und Unternehmensbilder</h2>
              {!media ? (
                <p role="alert">
                  Die Medien konnten nicht geladen werden. Die Gewerke können
                  unabhängig davon bearbeitet werden.
                </p>
              ) : (
                <>
                  {media.logo ? (
                    <CompanyImage image={media.logo} />
                  ) : (
                    <p>Kein Firmenlogo vorhanden.</p>
                  )}
                  {media.images.length ? (
                    media.images.map((image) => (
                      <figure key={image.id}>
                        <CompanyImage image={image} width={480} height={320} />
                        <figcaption>{image.alt}</figcaption>
                      </figure>
                    ))
                  ) : (
                    <p>Keine Unternehmensbilder vorhanden.</p>
                  )}
                </>
              )}
            </section>
            <ReviewActions
              key={profile.id}
              profileId={profile.id}
              status={profile.status}
              initialCategoryIds={profile.company_profile_categories.map(
                (category) => category.category_id,
              )}
            />
            <QualityReviewForm
              profileId={profile.id}
              review={profile.company_quality_reviews}
              request={profile.company_quality_requests}
            />
          </div>
        )
      )}
    </main>
  );
}
