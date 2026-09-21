import Link from "next/link";
import type { Listing, Category } from "@/types/portal";
import { formatLocation } from "@/lib/listings";
import { CompanyLogo } from "./company-image";
import { QualitySeal } from "@/components/quality/quality-seal";
import { Icon } from "./icon";

export function ListingRow({
  listing,
  categories,
  href,
}: {
  listing: Listing;
  categories: Category[];
  href: string;
}) {
  return (
    <article className="listing-row">
      <div
        className="row-logo"
        aria-label={
          listing.logo
            ? `Logo von ${listing.name}`
            : `Initialen ${listing.name}`
        }
      >
        <CompanyLogo
          key={listing.logo?.src ?? listing.initials}
          image={listing.logo}
          initials={listing.initials}
        />
      </div>
      <div className="row-content">
        {!listing.isDemo && listing.verification?.status === "verified" && (
          <QualitySeal note={listing.verification.public_note} />
        )}
        <span className="row-category">
          {categories
            .filter((c) => listing.categoryIds.includes(c.id))
            .map((c) => c.name)
            .join(" · ")}
        </span>
        <h3>
          <Link href={href}>{listing.name}</Link>
        </h3>
        {formatLocation(listing.location) && (
          <p className="location">
            <Icon name="pin" size={16} />
            {formatLocation(listing.location)}
          </p>
        )}
        <p>{listing.tagline}</p>
        {listing.businessAreas && <p>{listing.businessAreas}</p>}
        <div className="row-bottom">
          {listing.isDemo && <span className="badge">Beispielprofil</span>}
          <Link className="text-link" href={href}>
            Profil ansehen <Icon name="arrow" size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
