import { TravelSignals } from "./travel-signals";
import Image from "next/image";
import Link from "next/link";
import type { DiscoveryEntry } from "@/data/reiseportal-discovery";
import type { Listing } from "@/types/portal";
import { DiscoveryAdvertising } from "@/components/advertising/discovery-advertising";
import type { DiscoveryAdvertisingData } from "@/lib/discovery-advertising";
import { ProfileRotation } from "./profile-rotation";
import { profileGroups, selectRotatingProfiles } from "@/lib/profile-rotation";
import { Breadcrumbs } from "./breadcrumbs";
import { portalBreadcrumbs } from "@/lib/breadcrumbs";
import { JsonLd } from "./json-ld";
import { jsonLdGraph, breadcrumbSchema, collectionSchema } from "@/lib/seo-schema";
import { relatedTravelPages } from "@/lib/travel-relations";
import { TravelRelations } from "./travel-relations";
import { providerCardImage } from '@/lib/provider-card-media';
import cardStyles from './accommodation-card.module.css';

export function AccommodationCard({ listing, rotating = false, sizes }: { listing: Listing; rotating?: boolean; sizes?: string }) {
  const image = providerCardImage(listing, 'travel');
  return <article className="accommodation-card">
    <Link href={`/unterkuenfte/${listing.slug}`} className={cardStyles.card}
      aria-label={`${listing.name} – Details ansehen`}>
      <div className={`accommodation-card-image ${cardStyles.image}${image ? "" : " accommodation-card-image--empty"}`}>
        {image ? <Image src={image.src} alt={image.alt} fill loading="lazy"
          unoptimized={/^https?:\/\//.test(image.src)} sizes={sizes ?? (rotating
            ? "(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 45vw, 430px"
            : "(max-width: 700px) calc(100vw - 48px), (max-width: 1100px) 45vw, 25vw")} />
          : <span className={cardStyles.fallback} aria-hidden="true">{listing.initials}</span>}
      </div>
      <div className={`accommodation-card-copy ${cardStyles.copy}`}>
        <p className={cardStyles.location}>{[listing.location.city, listing.location.region, listing.location.country].filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(" · ")}</p>
        <h3>{listing.name}</h3>
        <div className={cardStyles.signals}><TravelSignals termKeys={listing.travelTermKeys} /></div>
        <span className={cardStyles.details}>Details ansehen <span aria-hidden="true">→</span></span>
      </div>
    </Link>
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
  const breadcrumbs = portalBreadcrumbs(entry.title, `${basePath}/${entry.slug}`, { name: title, path: basePath });
  const relations = relatedTravelPages(listings);
  return <main id="hauptinhalt" className="container trade-page discovery-detail">
    <JsonLd data={jsonLdGraph([breadcrumbSchema(breadcrumbs), collectionSchema({
      name: entry.title, description: entry.intro, path: `${basePath}/${entry.slug}`,
      about: basePath === "/reiseziele" ? { "@type": "Place", name: entry.title }
        : { "@type": "DefinedTerm", name: entry.title, termCode: `theme:${entry.slug}` },
      items: selected.map(listing => ({ name: listing.name, path: `/unterkuenfte/${listing.slug}` })),
    })])} />
    <Breadcrumbs items={breadcrumbs} />
    <header className="discovery-detail-hero">
      {entry.image && <Image src={entry.image} alt={entry.alt} fill sizes="100vw" priority />}
      <div><p className="eyebrow">{title}</p><h1>{entry.title}</h1></div>
    </header>
    <p className="discovery-intro">{entry.intro}</p>
    <section className="discovery-stays" aria-labelledby="related-stays">
        <div className="section-heading"><div><p className="eyebrow">Aus dem Reiseportal</p><h2 id="related-stays">Passende Unterkünfte</h2></div></div>
      <DiscoveryAdvertising data={advertising}><div className="discovery-detail-content">
      {listings.length > 0 ? <>
        {rotateProfiles ? <>
          <ProfileRotation key={selected.map((listing) => listing.id).join(",")} count={selected.length}
            groups={profileGroups(selected).map((group, index) =>
              <div className="accommodation-grid" key={index}>{group.map((listing) =>
                <AccommodationCard listing={listing} rotating key={listing.id} />)}</div>)} />
          <Link className="text-link" href={`/unterkuenfte-a-z?${basePath === "/reiseziele" ? "ziel" : "thema"}=${entry.slug}`}>Alle passenden Unterkünfte ansehen →</Link>
        </> : <div className="accommodation-grid">{listings.map((listing) => <AccommodationCard listing={listing} key={listing.id} />)}</div>}
      </> : <p>Für diese Rubrik sind derzeit keine freigegebenen Unterkünfte verfügbar.</p>}
      </div></DiscoveryAdvertising>
    </section>
    <TravelRelations title={basePath === "/reiseziele" ? "Reisethemen mit passenden Gastgebern" : "Reiseziele mit passenden Gastgebern"}
      links={basePath === "/reiseziele" ? relations.themes : relations.destinations} />
    <Link className="text-link discovery-back-link" href={basePath}>← Alle {title} ansehen</Link>
  </main>;
}
