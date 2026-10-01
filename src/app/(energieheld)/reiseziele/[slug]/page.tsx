import { notFound } from "next/navigation";
import { destinations } from "@/data/reiseportal-discovery";
import { DiscoveryDetail } from "@/components/portal/discovery-detail";
import { loadReiseportalDestination } from "@/lib/reiseportal-directory";
import { loadDiscoveryAdvertising } from "@/lib/discovery-advertising";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return destinations.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: destinations.find((entry) => entry.slug === slug)?.title ?? "Reiseziel" };
}

export default async function DestinationDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = destinations.find((item) => item.slug === slug);
  if (!entry) notFound();
  const [listings, advertising] = await Promise.all([loadReiseportalDestination(entry.slug), loadDiscoveryAdvertising(`/reiseziele/${entry.slug}`)]);
  return <DiscoveryDetail entry={entry} title="Reiseziele" basePath="/reiseziele" listings={listings} advertising={advertising} rotateProfiles />;
}
