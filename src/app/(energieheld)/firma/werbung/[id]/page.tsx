import { CampaignDetail } from "@/components/advertising/campaign-pages";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Angebotsanfrage",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <CampaignDetail id={(await params).id} />;
}
