export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { trades } from "@/config/trades";
import { DirectoryPage } from "@/components/portal/directory-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: trades.find((t) => t.id === slug)?.name ?? "Gewerk nicht gefunden",
  };
}
export default async function TradePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const trade = trades.find((t) => t.id === slug);
  if (!trade) notFound();
  return <DirectoryPage trade={trade} searchParams={searchParams} />;
}
