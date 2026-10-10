import { loadAdminTravelTaxonomy, type TravelReviewSnapshot } from "@/lib/admin-travel-taxonomy";
import { saveTravelTerms } from "@/app/(energieheld)/admin/firmen/[id]/travel-actions";
import { loadAdminProfileFreshness } from '@/lib/profile-freshness';
import type { ContentFreshness } from '@/lib/content-freshness';
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { loadAccommodationPage } from "@/lib/accommodation-page";
import { ListingDetail } from "@/components/portal/listing-detail";
import { InquiryDialog } from "@/components/leads/inquiry-dialog";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin, canReviewProfiles, isProfileId, loadReviewProfile } from "@/lib/admin-review";
import { signCompanyMedia, type MediaRow, type SignedMedia } from "@/lib/company-media";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { InlineProfileEditor } from "@/components/admin/inline-profile-editor";
import { saveInlineProfile, saveInlineMedia, reviewInlineProfile, withdrawInlineProfileReview } from "@/app/(energieheld)/experten/[slug]/inline-actions";
import { saveInlineContent } from "@/app/(energieheld)/experten/[slug]/content-actions";
import { saveInlineBlockImage } from "@/app/(energieheld)/experten/[slug]/block-image-actions";
import { createPublicClient } from "@/lib/supabase/public";
import { loadPublicProfileContent, splitProfileContent } from "@/lib/profile-content";
import { ProfileEditorialContent } from "@/components/portal/profile-content-blocks";
import { isLiveDemoProfile } from "@/lib/reiseportal-demo";
import { pageMetadata, profileMetadata, indexableProfile } from "@/lib/seo";
import { portalBreadcrumbs } from "@/lib/breadcrumbs";
import { Breadcrumbs } from "@/components/portal/breadcrumbs";
import { JsonLd } from "@/components/portal/json-ld";
import { jsonLdGraph, breadcrumbSchema, profileSchema } from "@/lib/seo-schema";
import { relatedTravelPages } from "@/lib/travel-relations";
import { TravelRelations } from "@/components/portal/travel-relations";

export const dynamic = "force-dynamic";
function redirectLegacySlug(slug: string) {
  // Next's route params can retain URL encoding; this is one verified alias.
  if (slug === "höflehner" || slug.toLowerCase() === "h%c3%b6flehner")
    permanentRedirect("/unterkuenfte/hoeflehner");
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirectLegacySlug(slug);
  const result = await loadAccommodationPage(slug);
  if (result.error) return pageMetadata({ title: "Profil derzeit nicht verfügbar", description: result.error, noindex: true });
  if (!result.data) notFound();
  return profileMetadata(result.data);
}

export default async function AccommodationDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirectLegacySlug(slug);
  const result = await loadAccommodationPage(slug);
  if (result.error)
    return (
      <main id="hauptinhalt" className="container detail-page">
        <h1>Profil derzeit nicht verfügbar</h1>
        <div className="empty-state" role="alert">
          <p>{result.error}</p>
        </div>
      </main>
    );
  const listing = result.data;
  if (!listing) notFound();
  const breadcrumbs = portalBreadcrumbs(listing.name, `/unterkuenfte/${listing.slug}`, { name: "Unterkünfte A–Z", path: "/unterkuenfte-a-z" });
  const relations = indexableProfile(listing) ? relatedTravelPages([listing]) : { themes: [], destinations: [] };
  const liveDemo = isLiveDemoProfile(listing);
  const storedProfile = !listing.isPreview && isProfileId(listing.id) && (!listing.isDemo || liveDemo);
  const content = storedProfile && !liveDemo
    ? await loadPublicProfileContent(createPublicClient(), listing.id)
    : { blocks: [], available: false, imagesAvailable: false };
  const presentedContent = splitProfileContent(content.blocks, listing.name);
  let editorData: { values: ProfileValues; media: SignedMedia; rows: MediaRow[]; freshness: ContentFreshness | null; canReview: boolean; travel?: TravelReviewSnapshot; travelError?: string } | null = null;
  let editorContent = content;
  if (storedProfile) {
    try {
      const client = await createClient();
      if (await checkAdmin(client) === "admin") {
        const freshness = await loadAdminProfileFreshness(client, listing.id);
        const review = await loadReviewProfile(client, listing.id);
        const profile = review.profile;
        if (review.access === "admin" && !review.error && profile?.status === "approved") {
          const media = await signCompanyMedia(client, profile, true);
          editorContent = await loadPublicProfileContent(client, listing.id);
          const values = Object.fromEntries(
            profileFields.map((field) => [field, profile[field] ?? ""]),
          ) as ProfileValues;
          const travel = await loadAdminTravelTaxonomy(client, listing.id);
          editorData = { values, media, rows: profile.company_profile_images, freshness, canReview: await canReviewProfiles(client), travel: "error" in travel ? undefined : travel, travelError: "error" in travel ? travel.error : undefined };
        }
      }
    } catch {
      // Public rendering remains available when the admin-only read fails.
    }
  }
  return (
    <main id="hauptinhalt" className="container detail-page">
      <JsonLd data={indexableProfile(listing) ? jsonLdGraph([breadcrumbSchema(breadcrumbs), ...profileSchema(listing, result.terms)]) : null} />
      <Breadcrumbs items={breadcrumbs} />
      {editorData ? <InlineProfileEditor
        travelError={editorData.travelError}
        travelReview={editorData.travel ? { snapshot: editorData.travel, saveAction: saveTravelTerms.bind(null, listing.id) } : undefined}
        freshness={editorData.freshness}
        reviewFreshness={editorData.canReview ? reviewInlineProfile.bind(null, listing.id, slug) : undefined}
        withdrawFreshness={editorData.canReview ? withdrawInlineProfileReview.bind(null, listing.id, slug) : undefined}
        listing={listing}
        categories={[]}
        showVerification={false}
        values={editorData.values}
        media={editorData.media}
        rows={editorData.rows}
        contactAction={!listing.isDemo ? <InquiryDialog profileId={listing.id} companyName={listing.name} /> : undefined}
        saveProfile={saveInlineProfile.bind(null, listing.id, slug)}
        saveMedia={saveInlineMedia.bind(null, listing.id, slug)}
        contentBlocks={editorContent.blocks}
        publicContentBlocks={content.blocks}
        contentAvailable={editorContent.available}
        imagesAvailable={editorContent.imagesAvailable}
        saveContent={saveInlineContent.bind(null, listing.id, slug)}
        saveBlockImage={saveInlineBlockImage.bind(null, listing.id, slug)}
        allowDemoMap={liveDemo}
        originalDemoMedia={liveDemo}
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
        editorialContent={content.available && (listing.description || listing.businessAreas || presentedContent.blocks.length)
          ? <ProfileEditorialContent items={presentedContent.items} listing={listing} /> : undefined}
        contactAction={
          !listing.isDemo && !listing.isPreview ? (
            <InquiryDialog profileId={listing.id} companyName={listing.name} />
          ) : undefined
        }
      />}
      <TravelRelations title="Reiseinformationen und passende Rubriken" links={[...relations.destinations, ...relations.themes]} facts={result.terms} />
      <Link className="text-link back-link" href="/unterkuenfte-a-z">
        ← Zurück zu Unterkünfte A–Z
      </Link>
    </main>
  );
}
