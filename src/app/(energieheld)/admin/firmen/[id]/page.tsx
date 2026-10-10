import { loadProfileImports } from '@/lib/profile-import';
import { ProfileImportNotice } from '@/components/admin/profile-import-notice';
import { ProfilePublicVisibility } from "@/components/admin/profile-public-visibility";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewProfile } from "@/lib/admin-review";
import { requireAdminAccess, formatSubmission, legalName } from "@/lib/admin";
import { profileStatus } from "@/lib/auth";
import { signCompanyMedia } from "@/lib/company-media";
import { CompanyImage } from "@/components/portal/company-image";
import { ReviewActions } from "@/components/admin/review-actions";
import { QualityReviewForm } from "@/components/quality/quality-review-form";
import { TravelTaxonomyEditor } from "@/components/admin/travel-taxonomy-editor";
import { loadAdminTravelTaxonomy } from "@/lib/admin-travel-taxonomy";
import { loadReviewFeedback } from "@/lib/editorial-queue";
import { TravelReviewProvider } from "@/components/admin/travel-review-context";
import { loadEditorialNote } from "@/lib/owner-profile-input";
import { saveTravelTerms } from "./travel-actions";
import styles from "@/components/admin/admin.module.css";

export const metadata = { title: "Firmenprofil prüfen", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  const result = await loadReviewProfile(client, id);
  requireAdminAccess(result.access);
  if (!result.error && !result.profile) notFound();
  if (result.error || !result.profile) return <main id="hauptinhalt" className={`container ${styles.page}`}><p role="alert">{result.error}</p></main>;
  const profile = result.profile;
  const importEntry = (await loadProfileImports(client, [id])).get(id);
  const editorHref = `/admin/firmen/${profile.id}/vorschau?bearbeiten=1`;
  const [editorialNote, travelTaxonomy, media, feedback] = await Promise.all([
    loadEditorialNote(client, profile.id), loadAdminTravelTaxonomy(client, profile.id),
    signCompanyMedia(client, profile).catch(() => null), loadReviewFeedback(client, profile.id),
  ]);
  const fields = [
    ["Weitere Informationen zum Angebot", profile.business_areas], ["Einreichungsdatum", formatSubmission(profile.submitted_at)],
    ["Kurzbeschreibung", profile.tagline], ["Beschreibung", profile.description],
    ["Telefon", profile.phone], ["Öffentliche E-Mail", profile.public_email], ["Website", profile.website],
    ["Straße", profile.street], ["PLZ", profile.postal_code], ["Ort", profile.city], ["Region", profile.region], ["Land", profile.country],
  ];
  const editorLink = <Link className="button button-primary" href={editorHref}>Profil redaktionell bearbeiten</Link>;
  const visibility = await client.from('company_profile_public_visibility').select('is_listed').eq('profile_id', id).maybeSingle();
  return <main id="hauptinhalt" className={`container ${styles.page}`}>
    <header className={styles.reviewHeader}>
      <Link className="button" href="/admin">Zurück zum Adminbereich</Link>
      <h1>Firmenprofil prüfen</h1>
      <dl className={styles.details}>
        <div><dt>Firmenname</dt><dd>{legalName(profile.companies)}</dd></div>
        <div><dt>Öffentlicher Profilname</dt><dd>{profile.display_name}</dd></div>
        <div><dt>Aktueller Status</dt><dd>{profileStatus(profile.status)}</dd></div>
      </dl>
      {editorLink}
    </header>
    <ProfileImportNotice entry={importEntry} status={profile.status}/>
    <ProfilePublicVisibility profileId={id} listed={visibility.data?.is_listed !== false} />
    <TravelReviewProvider key={JSON.stringify(travelTaxonomy)} snapshot={"error" in travelTaxonomy ? { terms: [], assignedKeys: [], proposedKeys: [] } : travelTaxonomy} saveAction={saveTravelTerms.bind(null, profile.id)}>
    <div className={styles.card}>
      <section id="angaben" className={styles.reviewSection} aria-labelledby="review-details-title">
        <h2 id="review-details-title">Angaben und Hinweise</h2>
        <dl className={styles.details}>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Nicht angegeben"}</dd></div>)}</dl>
        <section aria-labelledby="company-note-title">
          <h3 id="company-note-title">Hinweise des Unternehmens</h3>
          {"error" in editorialNote ? <p role="alert">{editorialNote.error}</p> : <p className={styles.reviewNote}>{editorialNote.note || "Keine Hinweise hinterlegt."}</p>}
          {editorLink}
          {feedback.error ? <p role="alert">{feedback.error}</p> : feedback.message && <><h3>Hinweis der Redaktion</h3><p className={styles.reviewNote}>{feedback.message}</p></>}
        </section>
        <section aria-labelledby="review-media-title">
          <h3 id="review-media-title">Firmenlogo und Unternehmensbilder</h3>
          {!media ? <p role="alert">Die Medien konnten nicht geladen werden. Die übrigen Angaben können unabhängig davon geprüft werden.</p> : <>
            {media.logo ? <CompanyImage image={media.logo} /> : <p>Kein Firmenlogo vorhanden.</p>}
            {media.images.length ? media.images.map(image => <figure key={image.id}><CompanyImage image={image} width={480} height={320} /><figcaption>{image.alt}</figcaption></figure>) : <p>Keine Unternehmensbilder vorhanden.</p>}
          </>}
        </section>
      </section>
      <div id="reisezuordnungen" className={styles.reviewSection}>
        {!travelTaxonomy ? <p role="alert">Die Reisezuordnungen konnten nicht geladen werden.</p> : "error" in travelTaxonomy ? <p role="alert">{travelTaxonomy.error}</p> : <TravelTaxonomyEditor published={profile.status === "approved"} />}
      </div>
      <section id="verifizierung" className={styles.reviewSection} aria-labelledby="quality-section-title">
        <h2 id="quality-section-title">Optionale Qualitätsprüfung</h2>
        <p>Die persönliche Verifizierung ist unabhängig von der Erstfreischaltung.</p>
        <QualityReviewForm profileId={profile.id} review={profile.company_quality_reviews} request={profile.company_quality_requests} />
      </section>
      <section id="pruefung" className={styles.reviewSection} aria-labelledby="review-finish-title">
        <h2 id="review-finish-title">Redaktionelle Entscheidung</h2>
        <ReviewActions key={profile.id} profileId={profile.id} status={profile.status} canReview={result.access === "admin"} />
      </section>
    </div>
    </TravelReviewProvider>
    <nav className={styles.reviewSticky} aria-label="Redaktionelle Profilaktion"><span>{profile.display_name} · {profileStatus(profile.status)}</span>{editorLink}</nav>
  </main>;
}
