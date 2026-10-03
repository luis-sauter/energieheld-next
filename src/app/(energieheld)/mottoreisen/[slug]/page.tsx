import { notFound } from "next/navigation";
import { travelThemes } from "@/data/reiseportal-discovery";
import { DiscoveryDetail } from "@/components/portal/discovery-detail";
import { loadReiseportalTheme } from "@/lib/reiseportal-directory";
import { loadDiscoveryAdvertising } from "@/lib/discovery-advertising";
import { discoveryMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return travelThemes.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = travelThemes.find((entry) => entry.slug === slug);
  if (!entry) notFound();
  return discoveryMetadata(entry, "theme");
}

export default async function ThemeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = travelThemes.find((item) => item.slug === slug);
  if (!entry) notFound();
  const [listings, advertising] = await Promise.all([loadReiseportalTheme(entry.slug), loadDiscoveryAdvertising(`/mottoreisen/${entry.slug}`)]);
  return <DiscoveryDetail entry={entry} title="Mottoreisen" basePath="/mottoreisen" listings={listings} advertising={advertising} rotateProfiles />;
}
