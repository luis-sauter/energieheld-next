import Link from "next/link";
import type { Listing, Category } from "@/types/portal";
import { CompanyLogo } from "./company-image";
import { QualitySeal } from "@/components/quality/quality-seal";
import { Icon } from "./icon";

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
}: {
  listing: Listing;
  categories: Category[];
  href: string;
}) {
  const premium = listing.directoryPackage === "premium";
  const address = [
    listing.location.street,
    [listing.location.postalCode, listing.location.city].filter(Boolean).join(" "),
    listing.location.region,
  ].filter(Boolean).join(", ");
  const website = websiteUrl(listing.contact.website);
  const phoneHref = listing.contact.phone.replace(/[^\d+]/g, "");
  return (
    <article className={`listing-row listing-row--${premium ? "premium" : "basic"}`}>
      {premium && (
        <div className="row-logo" aria-label={listing.logo ? `Logo von ${listing.name}` : `Initialen ${listing.name}`}>
          <CompanyLogo key={listing.logo?.src ?? listing.initials} image={listing.logo} initials={listing.initials} />
        </div>
      )}
      <div className="row-content">
        <div className="row-heading">
          <h3><Link href={href}>{listing.name}</Link></h3>
          {!listing.isDemo && listing.verification?.status === "verified" && (
            <QualitySeal note={listing.verification.public_note} />
          )}
        </div>
        <div className="row-categories">
          {categories
            .filter((category) => listing.categoryIds.includes(category.id))
            .map((category) => <span className="row-category" key={category.id}>{category.name}</span>)}
        </div>
        {listing.tagline && <p className="row-tagline">{listing.tagline}</p>}
        {premium && listing.businessAreas && <p className="row-business-areas">{listing.businessAreas}</p>}
        {listing.isDemo && <span className="badge row-demo">Beispielprofil</span>}
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
        <Link className="row-profile-link" href={href}>Unternehmensprofil</Link>
      </div>
    </article>
  );
}
