import Link from "next/link";
import type { Listing, Category } from "@/types/portal";
import { CompanyImage } from "./company-image";
import { QualitySeal } from "@/components/quality/quality-seal";
import { Icon } from "./icon";
import { providerCardImage } from '@/lib/provider-card-media';

function websiteUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function ListingRow({
  listing,
  categories,
  href,
  showVerification = true,
  travel = false,
  travelLabels = {},
  adminStatus,
}: {
  listing: Listing;
  categories: Category[];
  href: string;
  showVerification?: boolean;
  travel?: boolean;
  travelLabels?: Record<string, string>;
  adminStatus?: React.ReactNode;
}) {
  const cardImage = travel ? providerCardImage(listing, 'directory') : listing.directoryImage ?? listing.logo ?? listing.images[0];
  const isLogo = Boolean(cardImage && listing.logo?.src === cardImage.src);
  const premium = listing.directoryPackage === "premium" && (travel || Boolean(cardImage));
  const teaser = listing.tagline || (travel ? listing.description.replace(/\s+/g, " ").trim().slice(0, 240) : "");
  const tags = travel ? [...new Set((listing.travelTermKeys ?? []).flatMap((key) => travelLabels[key] ? [travelLabels[key]] : []))] : [];
  const address = [
    listing.location.street,
    [listing.location.postalCode, listing.location.city].filter(Boolean).join(" "),
    listing.location.region || listing.location.country,
  ].filter(Boolean).join(", ");
  const website = websiteUrl(listing.contact.website);
  const phoneHref = listing.contact.phone.replace(/[^\d+]/g, "");
  return (
    <article className={`listing-row listing-row--${premium ? "premium" : "basic"}`}>
      {(premium || travel) && (
        <div className={`row-logo${travel && isLogo ? " row-logo--contain" : ""}`}>
          {cardImage ? <CompanyImage key={cardImage.src} image={cardImage} cover fit={travel && isLogo ? "contain" : "cover"} optimizeLocal={travel}
            sizes={travel ? (premium ? "(max-width: 600px) 160px, 220px" : "72px") : undefined} /> : <span aria-label={`Kein Bild für ${listing.name}`} className={travel ? "travel-image-fallback" : undefined}>{travel ? <Icon name="home" size={36} /> : listing.initials}</span>}
          {travel && premium && <span className="travel-premium-badge">Premium</span>}
        </div>
      )}
      <div className="row-content">
        <div className="row-heading">
          <h3><Link href={href}>{listing.name}</Link></h3>
          {adminStatus}
          {showVerification && !listing.isDemo && listing.verification?.status === "verified" && (
            <QualitySeal note={listing.verification.public_note} />
          )}
        </div>
        {travel && <p className="row-location"><Icon name="pin" size={16} />{[listing.location.city, listing.location.country].filter(Boolean).join(" · ")}</p>}
        <div className="row-categories">
          {categories
            .filter((category) => listing.categoryIds.includes(category.id))
            .map((category) => <span className="row-category" key={category.id}>{category.name}</span>)}
        </div>
        {teaser && <p className="row-tagline">{teaser}{travel && !listing.tagline && listing.description.length > 240 ? " …" : ""}</p>}
        {tags.length > 0 && <ul className="travel-card-tags" aria-label="Reisemerkmale">{tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
        {premium && listing.businessAreas && <p className="row-business-areas">{listing.businessAreas}</p>}
        {listing.isDemo && <span className="badge row-demo">{listing.demoLabel ?? "Beispielprofil"}</span>}
      </div>
      <div className="row-contact">
        {address && <p><Icon name="pin" size={15} /><span>{address}</span></p>}
        {premium && listing.contact.email && (
          <p><Icon name="mail" size={15} /><a href={`mailto:${listing.contact.email}`}>{listing.contact.email}</a></p>
        )}
        {listing.contact.phone && (
          <p><Icon name="phone" size={15} /><a href={`tel:${phoneHref}`}>{listing.contact.phone}</a></p>
        )}
        {premium && website && (
          <p><Icon name="globe" size={15} /><a href={website} target="_blank" rel="noopener noreferrer">{listing.contact.website}</a></p>
        )}
        <Link className="row-profile-link" href={href}>{travel ? (premium ? "Zum Unternehmensprofil" : "Zum Profil") : "Unternehmensprofil"}{travel && <Icon name="arrow" size={18} />}</Link>
      </div>
    </article>
  );
}
