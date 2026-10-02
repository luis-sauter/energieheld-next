import type { ReactNode } from "react";
import type { DiscoveryAdvertisingData } from "@/lib/discovery-advertising";
import { AdvertisingLayout } from "@/components/portal/trades";
import { InlineBannerProvider } from "./inline-banner-editor";
import { CampaignSlot } from "./campaign-view";
import { defaultSidebarOrder } from "@/lib/sidebar-order";

export function DiscoveryAdvertising({ data, children, compact = false }: { data?: DiscoveryAdvertisingData; children: ReactNode; compact?: boolean }) {
  if (!data) return children;
  const { ads, sidebarOrder, options } = data;
  if (compact) {
    // Presentation only: the full page-scoped inventory remains available to admins.
    // Prefer Premium, then the first occupied fixed position after display_source resolution.
    const featured = ["top_banner", ...defaultSidebarOrder].map(placement =>
      ads.find(ad => ad.placement === placement && ad.imageUrl && !ad.suppressed)).find(Boolean);
    return <InlineBannerProvider options={options}>
      {children}
      {(featured || options) && <div data-destination-promo>
        <CampaignSlot placement={featured?.placement ?? "top_banner"} ad={featured} />
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
