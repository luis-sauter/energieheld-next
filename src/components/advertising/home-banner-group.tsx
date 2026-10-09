"use client";
import type { ActiveAd, AdPlacementId } from "@/lib/ad-values";
import { useInlineBanners } from "./inline-banner-context";
import { CampaignSlot } from "./campaign-view";
import { AdvertisingRail } from "./advertising-rail";
import type { SidebarSlot } from "@/lib/sidebar-order";
import styles from "@/app/(energieheld)/home.module.css";
export function HomeBannerGroup({ ads, placements, label }: { ads: ActiveAd[]; placements: AdPlacementId[]; label: string }) {
  const inline = useInlineBanners();
  const visible = placements.some(slot => {
    const ad = inline && Object.hasOwn(inline.overrides, slot) ? inline.overrides[slot] : ads.find(row => row.placement === slot);
    return ad?.imageUrl && !ad.suppressed;
  });
  if (!inline && !visible) return null;
  return <section className={`section container ${styles.partners}`} aria-label={label}>
    {placements[0] === "top_banner" ? <CampaignSlot placement="top_banner" ad={ads.find(row => row.placement === "top_banner")} />
      : <AdvertisingRail slots={placements as SidebarSlot[]} visibleSlots={placements as SidebarSlot[]} ads={ads} showAdvertiseLink={false} />}
  </section>;
}
