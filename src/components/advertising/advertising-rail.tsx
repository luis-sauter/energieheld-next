"use client";

import Link from "next/link";
import { useInlineBanners } from "./inline-banner-context";
import { lazy, Suspense, type ReactNode } from "react";
import type { ActiveAd } from "@/lib/ad-values";
import { sidebarCreative } from "@/lib/advertising-rail";
import { defaultSidebarOrder, type SidebarSlot } from "@/lib/sidebar-order";
import { CampaignSlot } from "./campaign-view";

const InlineOrderEditor = lazy(() => import("@/components/admin/sidebar-order-editor")
  .then((module) => ({ default: module.InlineSidebarOrderEditor })));

export function AdvertisingRail({
  ads,
  editor,
  premium,
  visibleSlots = [...defaultSidebarOrder],
  showAdvertiseLink = true,
}: {
  slots: SidebarSlot[];
  ads: ActiveAd[];
  editor?: ReactNode;
  premium?: ReactNode;
  visibleSlots?: SidebarSlot[];
  showAdvertiseLink?: boolean;
}) {
  const inline = useInlineBanners();
  return (
    <aside className="commercial-sidebar advertising-rail" aria-label="Werbeanzeigen">
      <p className="advertising-rail-label">Anzeige</p>
      {premium}
      {editor ?? (inline?.reorder ? <Suspense fallback={<p role="status">Banner-Steuerung lädt …</p>}>
        <InlineOrderEditor ads={ads} slots={[...defaultSidebarOrder]} saveOrder={inline.reorder} visibleSlots={visibleSlots} />
      </Suspense> : (
        <div className="advertising-rail-creatives">
          {defaultSidebarOrder.filter(slot => visibleSlots.includes(slot)).map((slot) => {
            const ad = sidebarCreative(slot, ads);
            return ad || inline ? <CampaignSlot key={slot} placement={slot} ad={ad} showLabel={false} /> : null;
          })}
        </div>
      ))}
      {showAdvertiseLink && <Link className="advertise-link" href="/werbung">
        Hier könnte Ihre Anzeige stehen →
      </Link>}
    </aside>
  );
}
