import type { ReactNode } from "react";
import type { DiscoveryAdvertisingData } from "@/lib/discovery-advertising";
import { AdvertisingLayout } from "@/components/portal/trades";
import { InlineBannerProvider } from "./inline-banner-editor";
import { CampaignSlot } from "./campaign-view";
import { defaultSidebarOrder } from "@/lib/sidebar-order";
import Link from "next/link";

export function DiscoveryAdvertising({ data, children, compact = false }: { data?: DiscoveryAdvertisingData; children: ReactNode; compact?: boolean }) {
  if (!data) return children;
  const { ads, sidebarOrder, options } = data;
  if (compact) {
    // Presentation only: the full page-scoped inventory remains available to admins.
    // Prefer Premium, then the first occupied fixed position after display_source resolution.
    const featured = data.premiumAds?.[0] ?? ["top_banner", ...defaultSidebarOrder].map(placement =>
      ads.find(ad => ad.placement === placement && ad.imageUrl && !ad.suppressed)).find(Boolean);
    const borrowed = Boolean(featured && !ads.some(ad => ad.id === featured.id));
    return <InlineBannerProvider options={options}>
      {children}
      {(featured || options) && <div data-destination-promo>
        <CampaignSlot placement={featured?.placement ?? "top_banner"} ad={featured} editorialPromo compactPremium searchResult={borrowed} />
        {borrowed && options && <Link className="text-link" href={`/admin/werbung/${featured!.id}`}>Premium-Banner bearbeiten →</Link>}
      </div>}
      {options && <details data-destination-banner-management>
        <summary>Alle Bannerplätze verwalten</summary>
        <AdvertisingLayout ads={ads} sidebarOrder={sidebarOrder} collapseEmpty showEmptySlots>{null}</AdvertisingLayout>
      </details>}
    </InlineBannerProvider>;
  }
  return <InlineBannerProvider options={options}>
    <AdvertisingLayout ads={ads} sidebarOrder={sidebarOrder} collapseEmpty showEmptySlots={Boolean(options)}>{children}</AdvertisingLayout>
  </InlineBannerProvider>;
}
