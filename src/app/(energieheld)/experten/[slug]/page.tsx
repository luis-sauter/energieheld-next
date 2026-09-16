import Link from "next/link";
import { notFound } from "next/navigation";
import { listings } from "@/data/listings";
import { energieheld } from "@/config/energieheld";
import { ListingDetail } from "@/components/portal/listing-detail";
import { Icon } from "@/components/portal/icon";

export function generateStaticParams() {
  return listings.map(({ slug }) => ({ slug }));
}
export const dynamicParams = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title:
      listings.find((l) => l.slug === slug)?.name ?? "Profil nicht gefunden",
  };
}

export default async function ExpertDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = listings.find((l) => l.slug === slug);
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
