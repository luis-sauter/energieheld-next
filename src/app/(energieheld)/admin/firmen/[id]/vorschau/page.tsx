import { loadAdminTravelTaxonomy } from "@/lib/admin-travel-taxonomy";
import { saveTravelTerms } from "@/app/(energieheld)/admin/firmen/[id]/travel-actions";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewProfile, canReviewProfiles } from "@/lib/admin-review";
import { requireAdminAccess } from "@/lib/admin";
import { signCompanyMedia } from "@/lib/company-media";
import { companyProfileListing } from "@/lib/company-presentation";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { loadPublicProfileContent } from "@/lib/profile-content";
import { loadReiseportalListingBySlug, withLegacyImages } from "@/lib/reiseportal-directory";
import { publicSlugForStoredProfile } from "@/lib/reiseportal-demo";
import { InlineProfileEditor } from "@/components/admin/inline-profile-editor";
import { saveInlineProfile, saveInlineMedia, reviewInlineProfile, withdrawInlineProfileReview } from "@/app/(energieheld)/experten/[slug]/inline-actions";
import { saveInlineContent } from "@/app/(energieheld)/experten/[slug]/content-actions";
import { saveInlineBlockImage } from "@/app/(energieheld)/experten/[slug]/block-image-actions";

import { loadEditorialNote } from "@/lib/owner-profile-input";
import { loadAdminProfileFreshness } from "@/lib/profile-freshness";
import styles from "@/components/admin/admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redaktionelle Profilvorschau", robots: { index: false, follow: false } };

export default async function AdminProfilePreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ bearbeiten?: string | string[] }> }) {
  const { id } = await params;
  const editing = (await searchParams)?.bearbeiten === "1";
  const client = await createClient();
  const result = await loadReviewProfile(client, id);
  requireAdminAccess(result.access);
  if (!result.profile && !result.error) notFound();
  if (result.error || !result.profile) return <main id="hauptinhalt" className="container detail-page"><p role="alert">{result.error}</p></main>;
  const profile = result.profile;
  const slug = publicSlugForStoredProfile(profile);
  if (profile.status === "approved" && !editing) {
    const publicResult = await loadReiseportalListingBySlug(slug);
    if (publicResult.data?.id === id) redirect(`/unterkuenfte/${slug}`);
  }
  const [media, content, note, freshness, canReview, travel] = await Promise.all([
    signCompanyMedia(client, profile, true),
    loadPublicProfileContent(client, profile.id),
    loadEditorialNote(client, profile.id),
    loadAdminProfileFreshness(client, profile.id),
    canReviewProfiles(client),
    loadAdminTravelTaxonomy(client, profile.id),
  ]);
  const listing = withLegacyImages(companyProfileListing(profile, media));
  const values = Object.fromEntries(profileFields.map((field) => [field, profile[field] ?? ""])) as ProfileValues;
  return <main id="hauptinhalt" className="container detail-page">
    <nav className="breadcrumbs" aria-label="Brotkrumennavigation"><span>Adminbereich</span><span>/</span><span>Interne Profilvorschau</span></nav>
    <header><h1>{editing ? "Profil redaktionell bearbeiten" : "Interne Profilvorschau"}</h1><p>{profile.status === "approved" ? (editing ? "Interner Redaktionsbereich eines freigegebenen Profils." : "Dieses Profil ist nicht im Reiseportal-Verzeichnis sichtbar.") : "Dieses Profil ist noch nicht öffentlich sichtbar."}</p></header>
    <section className={styles.categories} aria-labelledby="preview-note-title">
      <h2 id="preview-note-title">Hinweise des Unternehmens</h2>
      {"error" in note ? <p role="alert">{note.error}</p> : <p className={styles.reviewNote}>{note.note || "Keine Hinweise hinterlegt."}</p>}
    </section>
    <InlineProfileEditor initialEditing={editing} returnHref={`/admin/firmen/${id}#reisezuordnungen`} freshness={freshness}
      travelError={"error" in travel ? travel.error : undefined}
      travelReview={"error" in travel ? undefined : { snapshot: travel, saveAction: saveTravelTerms.bind(null, id) }}
      reviewFreshness={canReview ? reviewInlineProfile.bind(null, id, slug) : undefined}
      withdrawFreshness={canReview ? withdrawInlineProfileReview.bind(null, id, slug) : undefined}
      listing={listing} categories={[]} showVerification={false}
      values={values} media={media} rows={profile.company_profile_images}
      contentBlocks={content.blocks} contentAvailable={content.available} imagesAvailable={content.imagesAvailable}
      saveProfile={saveInlineProfile.bind(null, id, slug)}
      saveMedia={saveInlineMedia.bind(null, id, slug)}
      saveContent={saveInlineContent.bind(null, id, slug)}
      saveBlockImage={saveInlineBlockImage.bind(null, id, slug)} />
  </main>;
}
