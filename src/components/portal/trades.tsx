import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Trade } from "@/config/trades";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import { AdvertisingRail } from "@/components/advertising/advertising-rail";
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
  collapseEmpty = false,
  showEmptySlots = false,
}: {
  children: ReactNode;
  ads?: ActiveAd[];
  sidebarOrder?: SidebarSlot[];
  sidebarEditor?: ReactNode;
  editorEnabled?: boolean;
  collapseEmpty?: boolean;
  showEmptySlots?: boolean;
}) {
  const hasRail = showEmptySlots || !collapseEmpty || ads.some((ad) => ad.placement !== "top_banner" && !ad.suppressed && ad.imageUrl);
  const top = ads.find((ad) => ad.placement === "top_banner");
  const layout = (
    <div className="commercial-layout">
      {(!collapseEmpty || showEmptySlots || (top?.imageUrl && !top.suppressed)) && <CampaignSlot
        placement="top_banner"
        ad={top}
      />}
      <div className={`commercial-columns${hasRail ? "" : " commercial-columns--no-rail"}`}>
        <div className="commercial-content">{children}</div>
        {hasRail && <AdvertisingRail slots={sidebarOrder} ads={ads} editor={sidebarEditor} />}
      </div>
    </div>
  );
  return editorEnabled
    ? <DirectoryEditModeProvider>{layout}</DirectoryEditModeProvider>
    : layout;
}
