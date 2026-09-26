import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewProfile } from "@/lib/admin-review";
import { requireAdminAccess } from "@/lib/admin";
import { signCompanyMedia } from "@/lib/company-media";
import { companyProfileListing } from "@/lib/company-presentation";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { loadPublicProfileContent } from "@/lib/profile-content";
import { loadReiseportalListingBySlug, withLegacyImages } from "@/lib/reiseportal-directory";
import { publicSlugForStoredProfile } from "@/lib/reiseportal-demo";
import { InlineProfileEditor } from "@/components/admin/inline-profile-editor";
import { saveInlineProfile, saveInlineMedia } from "@/app/(energieheld)/experten/[slug]/inline-actions";
import { saveInlineContent } from "@/app/(energieheld)/experten/[slug]/content-actions";
import { saveInlineBlockImage } from "@/app/(energieheld)/experten/[slug]/block-image-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redaktionelle Profilvorschau", robots: { index: false, follow: false } };

export default async function AdminProfilePreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createClient();
  const result = await loadReviewProfile(client, id);
  requireAdminAccess(result.access);
  if (!result.profile && !result.error) notFound();
  if (result.error || !result.profile) return <main id="hauptinhalt" className="container detail-page"><p role="alert">{result.error}</p></main>;
  const profile = result.profile;
  const slug = publicSlugForStoredProfile(profile);
  if (profile.status === "approved") {
    const publicResult = await loadReiseportalListingBySlug(slug);
    if (publicResult.data?.id === id) redirect(`/unterkuenfte/${slug}`);
  }
  const [media, content] = await Promise.all([
    signCompanyMedia(client, profile),
    loadPublicProfileContent(client, profile.id),
  ]);
  const listing = withLegacyImages(companyProfileListing(profile, media));
  const values = Object.fromEntries(profileFields.map((field) => [field, profile[field] ?? ""])) as ProfileValues;
  return <main id="hauptinhalt" className="container detail-page">
    <nav className="breadcrumbs" aria-label="Brotkrumennavigation"><Link href="/admin">Adminbereich</Link><span>/</span><span>Interne Profilvorschau</span></nav>
    <div className="profile-editor-toolbar"><div><h1>Interne Profilvorschau</h1><p>{profile.status === "approved" ? "Dieses Profil ist nicht im Reiseportal-Verzeichnis sichtbar." : "Dieses Profil ist noch nicht öffentlich sichtbar."}</p></div><Link href={`/admin/firmen/${id}`}>Prüfung und Freigabe</Link></div>
    <InlineProfileEditor listing={listing} categories={[]} showVerification={false}
      values={values} media={media} rows={profile.company_profile_images}
      contentBlocks={content.blocks} contentAvailable={content.available} imagesAvailable={content.imagesAvailable}
      saveProfile={saveInlineProfile.bind(null, id, slug)}
      saveMedia={saveInlineMedia.bind(null, id, slug)}
      saveContent={saveInlineContent.bind(null, id, slug)}
      saveBlockImage={saveInlineBlockImage.bind(null, id, slug)} />
  </main>;
}
