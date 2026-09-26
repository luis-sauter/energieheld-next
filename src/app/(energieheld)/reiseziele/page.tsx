import { ReiseOverview } from "@/components/portal/reise-overview";
import { destinations } from "@/data/reiseportal-discovery";

export const metadata = { title: "Reiseziele" };
export default function DestinationsPage() {
  return <ReiseOverview title="Reiseziele" entries={destinations} basePath="/reiseziele"
    intro="Reiseziele im deutschsprachigen Raum: Deutschland, Österreich, die Schweiz und Südtirol/Italien." />;
}
