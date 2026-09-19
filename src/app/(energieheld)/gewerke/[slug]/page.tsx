export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { trades } from "@/config/trades";
import { energieheld } from "@/config/energieheld";
import { DirectoryPage } from "@/components/portal/directory-page";

// Energieberatung is already an official profile category and advertising target,
// but is not one of the fourteen construction trades shown in the tile overview.
function findTrade(slug: string) {
  const trade = trades.find((item) => item.id === slug);
  if (trade) return trade;
  const advice = energieheld.categories.find(
    (category) => category.id === slug && slug === "energieberatung",
  );
  return advice
    ? {
        ...advice,
        image: "gewerke",
        description:
          "Energieberatung für Ihr Gebäude und Ihr Sanierungsvorhaben.",
      }
    : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: findTrade(slug)?.name ?? "Gewerk nicht gefunden",
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
  const trade = findTrade(slug);
  if (!trade) notFound();
  return <DirectoryPage trade={trade} searchParams={searchParams} />;
}
