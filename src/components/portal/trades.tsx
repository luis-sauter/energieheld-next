import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Trade } from "@/config/trades";
import { energyAds } from "@/data/energy-ads";
import { AdSlot } from "./ads";
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

export function AdvertisingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="commercial-layout">
      <AdSlot placement="trade_top" ad={energyAds[0]} />
      <div className="commercial-columns">
        <div className="commercial-content">{children}</div>
        <aside className="commercial-sidebar" aria-label="Werbeanzeigen">
          <p className="sidebar-title">Partner für Ihr Vorhaben</p>
          {energyAds.slice(1).map((ad) => (
            <AdSlot key={ad.id} placement={ad.placement} ad={ad} />
          ))}
          <Link className="advertise-link" href="/werbung">
            Hier könnte Ihre Anzeige stehen <Icon name="arrow" size={16} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
