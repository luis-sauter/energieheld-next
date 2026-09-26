import { notFound } from "next/navigation";
import { destinations } from "@/data/reiseportal-discovery";
import { DiscoveryDetail } from "@/components/portal/discovery-detail";

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
  return <DiscoveryDetail entry={entry} title="Reiseziele" basePath="/reiseziele" />;
}
