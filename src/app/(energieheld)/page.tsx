import Link from "next/link";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import { AdvertisingRail } from "@/components/advertising/advertising-rail";
import { ListingRow } from "@/components/portal/listing-row";
import { Icon } from "@/components/portal/icon";
import { loadReiseportalDirectory } from "@/lib/reiseportal-directory";
import { loadPublicAds } from "@/lib/public-ads";
import { loadPublicSidebarOrder } from "@/lib/public-sidebar-order";

const entrances = [
  { label: "Reiseziele", href: "/reiseziele" },
  { label: "Mottoreisen", href: "/mottoreisen" },
  { label: "Unterkünfte A–Z", href: "/unterkuenfte-a-z" },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const [directory, ads, sidebarOrder] = await Promise.all([
    loadReiseportalDirectory(),
    loadPublicAds(undefined, "homepage"),
    loadPublicSidebarOrder(),
  ]);

  return (
    <main id="hauptinhalt" className="editorial-home">
      <section className="portal-intro portal-intro--travel container">
        <div>
          <p className="eyebrow">Reisen und entdecken</p>
          <h1>DAS Reiseportal</h1>
          <p>Reiseziele, Mottoreisen und Unterkünfte im deutschsprachigen Raum entdecken.</p>
        </div>
      </section>
      <div className="container premium-space">
        <CampaignSlot placement="top_banner" ad={ads.find((ad) => ad.placement === "top_banner")} />
      </div>
      <section className="section container">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Entdecken</p>
            <h2>Das Reiseportal erkunden</h2>
          </div>
        </div>
        <div className="reise-overview-grid home-entrances">
          {entrances.map(({ label, href }) => (
            <Link className="category-card" href={href} key={href}>
              <h3>{label}</h3>
              <Icon name="arrow" size={18} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section container" aria-labelledby="unterkuenfte-vorschau">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Unterkünfte</p>
            <h2 id="unterkuenfte-vorschau">Unterkünfte A–Z</h2>
          </div>
          <Link className="text-link" href="/unterkuenfte-a-z">Alle Unterkünfte →</Link>
        </div>
        <div className="commercial-columns">
          <div className="listing-rows">
            {directory.preview.map((listing) => (
              <ListingRow key={listing.id} listing={listing} categories={[]}
                href={`/unterkuenfte/${listing.slug}`} showVerification={false} />
            ))}
          </div>
          <AdvertisingRail slots={sidebarOrder} ads={ads} />
        </div>
      </section>
    </main>
  );
}
