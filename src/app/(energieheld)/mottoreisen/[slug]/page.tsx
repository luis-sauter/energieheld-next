import { notFound } from "next/navigation";
import { travelThemes } from "@/data/reiseportal-discovery";
import { DiscoveryDetail } from "@/components/portal/discovery-detail";

export function generateStaticParams() {
  return travelThemes.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: travelThemes.find((entry) => entry.slug === slug)?.title ?? "Mottoreise" };
}

export default async function ThemeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = travelThemes.find((item) => item.slug === slug);
  if (!entry) notFound();
  return <DiscoveryDetail entry={entry} title="Mottoreisen" basePath="/mottoreisen" />;
}
