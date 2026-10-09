"use client";
import type { ActiveAd, AdPlacementId } from "@/lib/ad-values";
import { useInlineBanners } from "./inline-banner-context";
import { CampaignSlot } from "./campaign-view";
import { AdvertisingRail } from "./advertising-rail";
import type { SidebarSlot } from "@/lib/sidebar-order";
import styles from "@/app/(energieheld)/home.module.css";
export function HomeBannerGroup({ ads, placements, label, adminOnly = false }: { ads: ActiveAd[]; placements: AdPlacementId[]; label: string; adminOnly?: boolean }) {
  const inline = useInlineBanners();
  const visible = placements.some(slot => {
    const ad = inline && Object.hasOwn(inline.overrides, slot) ? inline.overrides[slot] : ads.find(row => row.placement === slot);
    return ad?.imageUrl && !ad.suppressed;
  });
  if (!inline && (adminOnly || !visible)) return null;
  // Public rows contain only actual creatives; admins retain all fixed slots.
  const displayedAds = inline ? ads : ads.filter(ad => ad.imageUrl && !ad.suppressed);
  return <section className={`section container ${styles.partners}`} aria-label={label}>
    {placements[0] === "top_banner" ? <CampaignSlot placement="top_banner" ad={ads.find(row => row.placement === "top_banner")} />
      : <AdvertisingRail slots={placements as SidebarSlot[]} visibleSlots={placements as SidebarSlot[]} ads={displayedAds} showAdvertiseLink={false} />}
  </section>;
}
