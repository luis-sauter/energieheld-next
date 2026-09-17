import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPortalCompanyBySlug } from "@/lib/portal-companies";
import { energieheld } from "@/config/energieheld";
import { ListingDetail } from "@/components/portal/listing-detail";
import { InquiryDialog } from "@/components/leads/inquiry-dialog";

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
  return (
    <main id="hauptinhalt" className="container detail-page">
      <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
        <Link href="/">Startseite</Link>
        <span>/</span>
        <Link href="/experten">Experten</Link>
        <span>/</span>
        <span>{listing.name}</span>
      </nav>
      <ListingDetail
        listing={listing}
        categories={energieheld.categories}
        presentation="company"
        contactAction={
          !listing.isDemo ? (
            <InquiryDialog profileId={listing.id} companyName={listing.name} />
          ) : undefined
        }
      />
      <Link className="text-link back-link" href="/experten">
        ← Zurück zur Expertenübersicht
      </Link>
    </main>
  );
}
