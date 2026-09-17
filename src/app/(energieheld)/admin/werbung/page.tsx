import { CampaignIndex } from "@/components/advertising/campaign-pages";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Werbekampagnen prüfen",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ seite?: string }>;
}) {
  return <CampaignIndex admin params={await searchParams} />;
}
