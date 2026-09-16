import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPublicCompanyBySlug } from "@/lib/public-companies";
import { energieheld } from "@/config/energieheld";
import { ListingDetail } from "@/components/portal/listing-detail";
import { Icon } from "@/components/portal/icon";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublicCompanyBySlug(slug);
  return { title: result.data?.name ?? "Unternehmensprofil" };
}

export default async function ExpertDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublicCompanyBySlug(slug);
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
        qualityArea={
          <section className="quality-area">
            <Icon name="shield" size={38} />
            <div>
              <p className="eyebrow">Für besondere Qualität</p>
              <h2>Der Energieheld-Qualitätsstempel</h2>
              <p>
                Hier kann künftig ein separat geprüfter Qualitätsstempel
                erscheinen. Ein Unternehmensprofil allein bedeutet keine
                Zertifizierung. Dieser Bereich ist ein Platzhalter, keine
                Auszeichnung.
              </p>
            </div>
          </section>
        }
      />
      <Link className="text-link back-link" href="/experten">
        ← Zurück zur Expertenübersicht
      </Link>
    </main>
  );
}
