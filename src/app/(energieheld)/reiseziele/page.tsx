import { ReiseOverview } from "@/components/portal/reise-overview";
import { destinations } from "@/data/reiseportal-discovery";
import { loadDiscoveryAdvertising } from "@/lib/discovery-advertising";

export const metadata = { title: "Reiseziele" };
export const dynamic = "force-dynamic";
export default async function DestinationsPage() {
  const advertising = await loadDiscoveryAdvertising("/reiseziele");
  return <ReiseOverview title="Reiseziele" entries={destinations} basePath="/reiseziele"
    advertising={advertising}
    intro="Reiseziele im deutschsprachigen Raum: Deutschland, Österreich, die Schweiz und Südtirol/Italien." />;
}
