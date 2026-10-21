"use client";
import type { ActiveAd, AdPlacementId } from "@/lib/ad-values";
import { useInlineBanners } from "./inline-banner-context";
import { CampaignSlot } from "./campaign-view";
import { AdvertisingRail } from "./advertising-rail";
import type { SidebarSlot } from "@/lib/sidebar-order";
import styles from "@/app/(energieheld)/home.module.css";
import { MottoRow } from '../portal/motto-row';
import rowStyles from '../portal/motto-detail.module.css';
export function HomeBannerGroup({ ads, placements, label, adminOnly = false, sliderAds, instanceId }: { ads: ActiveAd[]; placements: AdPlacementId[]; label: string; adminOnly?: boolean; sliderAds?: ActiveAd[]; instanceId?: string }) {
  const inline = useInlineBanners();
  const visible = Boolean(sliderAds?.length) || placements.some(slot => {
    const ad = inline && Object.hasOwn(inline.overrides, slot) ? inline.overrides[slot] : ads.find(row => row.placement === slot);
    return ad?.imageUrl && !ad.suppressed;
  });
  if (!inline && (adminOnly || !visible)) return null;
  // Public rows contain only actual creatives; admins retain all fixed slots.
  const displayedAds = inline ? ads : ads.filter(ad => ad.imageUrl && !ad.suppressed);
  if (sliderAds?.length) return <section className={`section container ${styles.partners}`} aria-label={label}>
    <div className={`${rowStyles.bannerRow} ${rowStyles.countryBannerRow}`}><MottoRow label={label} speed={22}>
      {inline ? placements.map(placement => <CampaignSlot key={placement} ad={sliderAds.find(ad => ad.placement === placement)} placement={placement} showLabel={false} />)
        : sliderAds.map(ad => <CampaignSlot key={ad.id} ad={ad} placement={ad.placement} showLabel={false} />)}
    </MottoRow></div>
  </section>;
  return <section className={`section container ${styles.partners}`} aria-label={label}>
    {placements[0] === "top_banner" ? <CampaignSlot compactPremium instanceId={instanceId} showLabel={false} placement="top_banner" ad={ads.find(row => row.placement === "top_banner")} />
      : <AdvertisingRail slots={placements as SidebarSlot[]} visibleSlots={placements as SidebarSlot[]} ads={displayedAds} showAdvertiseLink={false} />}
  </section>;
}
