import Image from "next/image";
import Link from "next/link";
import type { DiscoveryEntry } from "@/data/reiseportal-discovery";
import type { Listing } from "@/types/portal";
import { DiscoveryAdvertising } from "@/components/advertising/discovery-advertising";
import type { DiscoveryAdvertisingData } from "@/lib/discovery-advertising";
import { ProfileRotation } from "./profile-rotation";
import { profileGroups, selectRotatingProfiles } from "@/lib/profile-rotation";

export function AccommodationCard({ listing, rotating = false }: { listing: Listing; rotating?: boolean }) {
  const image = listing.images[0];
  return <article className="accommodation-card">
    <Link href={`/unterkuenfte/${listing.slug}`}
      className={`accommodation-card-image${image ? "" : " accommodation-card-image--empty"}`}
      aria-label={`${listing.name} ansehen`}>
      {image
        ? <Image src={image.src} alt={image.alt} fill loading="lazy" sizes={rotating
          ? "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 300px"
          : "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw"} />
        : <span aria-hidden="true">{listing.initials}</span>}
    </Link>
    <div className="accommodation-card-copy">
      <p className="eyebrow">{[listing.location.city, listing.location.country].filter(Boolean).join(", ")}</p>
      <h3><Link href={`/unterkuenfte/${listing.slug}`}>{listing.name}</Link></h3>
      {listing.tagline && <p>{listing.tagline}</p>}
      <Link className="text-link" href={`/unterkuenfte/${listing.slug}`}>Details ansehen →</Link>
    </div>
  </article>;
}

export function DiscoveryDetail({ entry, title, basePath, listings, advertising, rotateProfiles = false }: {
  entry: DiscoveryEntry;
  title: string;
  basePath: string;
  listings: Listing[];
  advertising?: DiscoveryAdvertisingData;
  rotateProfiles?: boolean;
}) {
  const selected = rotateProfiles ? selectRotatingProfiles(listings, entry.slug) : listings;
  return <main id="hauptinhalt" className="container trade-page discovery-detail">
    <nav className="breadcrumbs" aria-label="Brotkrumennavigation">
      <Link href="/">Startseite</Link><span>›</span>
      <Link href={basePath}>{title}</Link><span>›</span><span>{entry.title}</span>
    </nav>
    <header className="discovery-detail-hero">
      {entry.image && <Image src={entry.image} alt={entry.alt} fill sizes="100vw" priority />}
      <div><p className="eyebrow">{title}</p><h1>{entry.title}</h1></div>
    </header>
    <DiscoveryAdvertising data={advertising}><div className="discovery-detail-content">
      <p className="discovery-intro">{entry.intro}</p>
      {listings.length > 0 && <section className="section" aria-labelledby="related-stays">
        <div className="section-heading"><div><p className="eyebrow">Aus dem Reiseportal</p><h2 id="related-stays">Passende Unterkünfte</h2></div></div>
        {rotateProfiles ? <>
          <ProfileRotation key={selected.map((listing) => listing.id).join(",")} count={selected.length}
            groups={profileGroups(selected).map((group, index) =>
              <div className="accommodation-grid" key={index}>{group.map((listing) =>
                <AccommodationCard listing={listing} rotating key={listing.id} />)}</div>)} />
          <Link className="text-link" href={`/unterkuenfte-a-z?thema=${entry.slug}`}>Alle passenden Unterkünfte ansehen →</Link>
        </> : <div className="accommodation-grid">{listings.map((listing) => <AccommodationCard listing={listing} key={listing.id} />)}</div>}
      </section>}
      <Link className="text-link" href={basePath}>← Alle {title} ansehen</Link>
    </div></DiscoveryAdvertising>
  </main>;
}
