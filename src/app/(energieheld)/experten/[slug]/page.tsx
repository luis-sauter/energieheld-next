import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPortalCompanyBySlug } from "@/lib/portal-companies";
import { energieheld } from "@/config/energieheld";
import { ListingDetail } from "@/components/portal/listing-detail";
import { InquiryDialog } from "@/components/leads/inquiry-dialog";
import { createClient } from "@/lib/supabase/server";
import { checkAdmin, loadReviewProfile } from "@/lib/admin-review";
import { signCompanyMedia, type MediaRow, type SignedMedia } from "@/lib/company-media";
import { profileFields, type ProfileValues } from "@/lib/company-profile";
import { InlineProfileEditor } from "@/components/admin/inline-profile-editor";
import { saveInlineProfile, saveInlineMedia } from "./inline-actions";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPortalCompanyBySlug(slug);
  return { title: result.data?.name ?? "Unternehmensprofil" };
}

export default async function ExpertDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPortalCompanyBySlug(slug);
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
  let editorData: { values: ProfileValues; media: SignedMedia; rows: MediaRow[] } | null = null;
  if (!listing.isDemo) {
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
        <Link href="/experten">Experten</Link>
        <span>/</span>
        <span>{listing.name}</span>
      </nav>
      {editorData ? <InlineProfileEditor
        listing={listing}
        categories={energieheld.categories}
        values={editorData.values}
        media={editorData.media}
        rows={editorData.rows}
        contactAction={<InquiryDialog profileId={listing.id} companyName={listing.name} />}
        saveProfile={saveInlineProfile.bind(null, listing.id, slug)}
        saveMedia={saveInlineMedia.bind(null, listing.id, slug)}
      /> : <ListingDetail
        listing={listing}
        categories={energieheld.categories}
        presentation="company"
        showMap
        contactAction={
          !listing.isDemo ? (
            <InquiryDialog profileId={listing.id} companyName={listing.name} />
          ) : undefined
        }
      />}
      <Link className="text-link back-link" href="/experten">
        ← Zurück zur Expertenübersicht
      </Link>
    </main>
  );
}
