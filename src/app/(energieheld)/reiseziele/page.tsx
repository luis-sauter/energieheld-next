import { ReiseOverview } from "@/components/portal/reise-overview";
import { reiseziele } from "@/data/reiseportal-overviews";

export const metadata = { title: "Reiseziele" };
export default function DestinationsPage() {
  return <ReiseOverview title="Reiseziele" entries={reiseziele}
    intro="Reiseziele im deutschsprachigen Raum: Deutschland, Österreich, die Schweiz und Südtirol/Italien." />;
}
