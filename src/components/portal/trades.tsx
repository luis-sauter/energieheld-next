import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Trade } from "@/config/trades";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import type { ActiveAd } from "@/lib/ad-values";
import { defaultSidebarOrder, type SidebarSlot } from "@/lib/sidebar-order";
import { DirectoryEditModeProvider } from "@/components/admin/directory-edit-mode";
import { Icon } from "./icon";

export function TradeTiles({ items }: { items: Trade[] }) {
  return (
    <div className="trade-tiles">
      {items.map((trade) => (
        <Link
          className="trade-tile"
          href={`/gewerke/${trade.id}`}
          key={trade.id}
        >
          <div>
            <Image
              src={`/images/trades/${trade.image}.jpg`}
              alt={trade.name}
              fill
              sizes="(max-width: 600px) 50vw, 25vw"
            />
          </div>
          <h3>
            {trade.name}
            <Icon name="arrow" size={17} />
          </h3>
        </Link>
      ))}
    </div>
  );
}

export function AdvertisingLayout({
  children,
  ads = [],
  sidebarOrder = [...defaultSidebarOrder],
  sidebarEditor,
  editorEnabled = false,
}: {
  children: ReactNode;
  ads?: ActiveAd[];
  sidebarOrder?: SidebarSlot[];
  sidebarEditor?: ReactNode;
  editorEnabled?: boolean;
}) {
  const layout = (
    <div className="commercial-layout">
      <CampaignSlot
        placement="top_banner"
        ad={ads.find((ad) => ad.placement === "top_banner")}
      />
      <div className="commercial-columns">
        <div className="commercial-content">{children}</div>
        <aside className="commercial-sidebar" aria-label="Werbeanzeigen">
          <p className="sidebar-title">Partner für Ihr Vorhaben</p>
          {sidebarEditor ?? sidebarOrder.map((placement) => (
            <CampaignSlot
              key={placement}
              placement={placement}
              ad={ads.find((ad) => ad.placement === placement)}
            />
          ))}
          <Link className="advertise-link" href="/werbung">
            Hier könnte Ihre Anzeige stehen <Icon name="arrow" size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
  return editorEnabled
    ? <DirectoryEditModeProvider>{layout}</DirectoryEditModeProvider>
    : layout;
}
