import { ReiseOverview } from "@/components/portal/reise-overview";
import { travelThemes } from "@/data/reiseportal-discovery";

export const metadata = { title: "Mottoreisen" };
export default function MottoTravelPage() {
  return <ReiseOverview title="Mottoreisen" entries={travelThemes} basePath="/mottoreisen"
    intro="Reisen nach persönlichen Vorlieben und Interessen im deutschsprachigen Raum." />;
}
