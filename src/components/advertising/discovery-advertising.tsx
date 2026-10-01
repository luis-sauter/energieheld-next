import type { ReactNode } from "react";
import type { DiscoveryAdvertisingData } from "@/lib/discovery-advertising";
import { AdvertisingLayout } from "@/components/portal/trades";
import { InlineBannerProvider } from "./inline-banner-editor";

export function DiscoveryAdvertising({ data, children }: { data?: DiscoveryAdvertisingData; children: ReactNode }) {
  if (!data) return children;
  const { ads, sidebarOrder, options } = data;
  return <InlineBannerProvider options={options}>
    <AdvertisingLayout ads={ads} sidebarOrder={sidebarOrder} collapseEmpty showEmptySlots={Boolean(options)}>{children}</AdvertisingLayout>
  </InlineBannerProvider>;
}
