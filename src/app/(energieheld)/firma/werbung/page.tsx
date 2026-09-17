import { CampaignIndex } from "@/components/advertising/campaign-pages";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Meine Werbekampagnen",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ seite?: string; fehler?: string }>;
}) {
  return <CampaignIndex params={await searchParams} />;
}
