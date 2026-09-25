import Link from "next/link";
import type { ReactNode } from "react";
import type { ActiveAd } from "@/lib/ad-values";
import { sidebarCreative } from "@/lib/advertising-rail";
import type { SidebarSlot } from "@/lib/sidebar-order";
import { CampaignSlot } from "./campaign-view";

export function AdvertisingRail({
  slots,
  ads,
  editor,
}: {
  slots: SidebarSlot[];
  ads: ActiveAd[];
  editor?: ReactNode;
}) {
  return (
    <aside className="commercial-sidebar advertising-rail" aria-label="Werbeanzeigen">
      <p className="advertising-rail-label">Anzeige</p>
      {editor ?? (
        <div className="advertising-rail-creatives">
          {slots.map((slot) => {
            const ad = sidebarCreative(slot, ads);
            return ad ? <CampaignSlot key={slot} placement={slot} ad={ad} showLabel={false} /> : null;
          })}
        </div>
      )}
      <Link className="advertise-link" href="/werbung">
        Hier könnte Ihre Anzeige stehen →
      </Link>
    </aside>
  );
}
