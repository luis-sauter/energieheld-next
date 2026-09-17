import { CampaignDetail } from "@/components/advertising/campaign-pages";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Werbekampagne prüfen",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CampaignDetail admin id={(await params).id} />;
}
