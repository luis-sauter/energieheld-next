import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { loadReiseportalListingBySlug } from "@/lib/reiseportal-directory";
import { ListingDetail } from "@/components/portal/listing-detail";
import { InquiryDialog } from "@/components/leads/inquiry-dialog";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin, loadReviewProfile } from "@/lib/admin-review";
import { signCompanyMedia, type MediaRow, type SignedMedia } from "@/lib/company-media";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { InlineProfileEditor } from "@/components/admin/inline-profile-editor";
import { saveInlineProfile, saveInlineMedia } from "@/app/(energieheld)/experten/[slug]/inline-actions";
import { saveInlineContent } from "@/app/(energieheld)/experten/[slug]/content-actions";
import { saveInlineBlockImage } from "@/app/(energieheld)/experten/[slug]/block-image-actions";
import { createPublicClient } from "@/lib/supabase/public";
import { loadPublicProfileContent, splitProfileContent } from "@/lib/profile-content";
import { ProfileContentBlocks } from "@/components/portal/profile-content-blocks";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "höflehner") permanentRedirect("/unterkuenfte/hoeflehner");
  const result = await loadReiseportalListingBySlug(slug);
  return { title: result.data?.name ?? "Unternehmensprofil" };
}

export default async function AccommodationDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "höflehner") permanentRedirect("/unterkuenfte/hoeflehner");
  const result = await loadReiseportalListingBySlug(slug);
  if (result.error)
    return (
      <main id="hauptinhalt" className="container detail-page">
        <div className="empty-state" role="alert">
          <p>{result.error}</p>
        </div>
      </main>
    );
  const listing = result.data;
  if (!listing) notFound();
  const content = !listing.isDemo && !listing.isPreview
    ? await loadPublicProfileContent(createPublicClient(), listing.id)
    : { blocks: [], available: false, imagesAvailable: false };
  const presentedContent = splitProfileContent(content.blocks, listing.name);
  let editorData: { values: ProfileValues; media: SignedMedia; rows: MediaRow[] } | null = null;
  if (!listing.isDemo && !listing.isPreview) {
    try {
      const client = await createClient();
      if (await checkAdmin(client) === "admin") {
        const review = await loadReviewProfile(client, listing.id);
        const profile = review.profile;
        if (review.access === "admin" && !review.error && profile?.status === "approved") {
          const media = await signCompanyMedia(client, profile);
          const values = Object.fromEntries(
            profileFields.map((field) => [field, profile[field] ?? ""]),
          ) as ProfileValues;
          editorData = { values, media, rows: profile.company_profile_images };
        }
      }
    } catch {
      // Public rendering remains available when the admin-only read fails.
    }
  }
  return (
    <main id="hauptinhalt" className="container detail-page">
      <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
        <Link href="/">Startseite</Link>
        <span>/</span>
        <Link href="/unterkuenfte-a-z">Unterkünfte A–Z</Link>
        <span>/</span>
        <span>{listing.name}</span>
      </nav>
      {editorData ? <InlineProfileEditor
        listing={listing}
        categories={[]}
        showVerification={false}
        values={editorData.values}
        media={editorData.media}
        rows={editorData.rows}
        contactAction={<InquiryDialog profileId={listing.id} companyName={listing.name} />}
        saveProfile={saveInlineProfile.bind(null, listing.id, slug)}
        saveMedia={saveInlineMedia.bind(null, listing.id, slug)}
        contentBlocks={content.blocks}
        contentAvailable={content.available}
        imagesAvailable={content.imagesAvailable}
        saveContent={saveInlineContent.bind(null, listing.id, slug)}
        saveBlockImage={saveInlineBlockImage.bind(null, listing.id, slug)}
      /> : <ListingDetail
        listing={listing}
        categories={[]}
        showVerification={false}
        presentation="company"
        showMap
        allowDemoMap={listing.slug === "demo-gmbh"}
        originalDemoMedia={listing.slug === "demo-gmbh"}
        aboutHeading={presentedContent.aboutHeading}
        businessHeading={presentedContent.businessHeading}
        contentBlocks={presentedContent.blocks.length
          ? <ProfileContentBlocks blocks={presentedContent.blocks} /> : undefined}
        contactAction={
          !listing.isDemo && !listing.isPreview ? (
            <InquiryDialog profileId={listing.id} companyName={listing.name} />
          ) : undefined
        }
      />}
      <Link className="text-link back-link" href="/unterkuenfte-a-z">
        ← Zurück zu Unterkünfte A–Z
      </Link>
    </main>
  );
}
