import { ReiseOverview } from "@/components/portal/reise-overview";
import { mottoreisen } from "@/data/reiseportal-overviews";

export const metadata = { title: "Mottoreisen" };
export default function MottoTravelPage() {
  return <ReiseOverview title="Mottoreisen" entries={mottoreisen}
    intro="Reisen nach persönlichen Vorlieben und Interessen im deutschsprachigen Raum." />;
}
