import Image from "next/image";
import Link from "next/link";
import type { Category, Listing, QualityBadge } from "@/types/portal";
import { Icon } from "./icon";

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function ListingCard({
  listing,
  categories,
  href,
  qualityBadge,
}: {
  listing: Listing;
  categories: Category[];
  href: string;
  qualityBadge?: QualityBadge;
}) {
  return (
    <article className="listing-card">
      <div className="card-image">
        <Image
          src={listing.images[0].src}
          alt={listing.images[0].alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
        />
        {listing.isDemo && <span className="demo-label">Beispielprofil</span>}
        <div
          className="provider-monogram"
          aria-label={`Beispiellogo ${listing.name}`}
        >
          {listing.initials}
        </div>
      </div>
      <div className="card-body">
        <p className="card-category">
          {categories
            .filter((c) => listing.categoryIds.includes(c.id))
            .map((c) => c.name)
            .join(" · ")}
        </p>
        <h3>
          <Link href={href}>{listing.name}</Link>
        </h3>
        <p className="card-tagline">{listing.tagline}</p>
        <p className="location">
          <Icon name="pin" size={16} />
          {listing.location.city}, {listing.location.region}
        </p>
        <div className="card-services">
          {listing.services.slice(0, 2).map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
        {qualityBadge && (
          <div className="quality-preview">
            <Icon name="shield" size={16} />
            {qualityBadge.label}
          </div>
        )}
        <Link
          href={href}
          className="card-link"
          aria-label={`Profil von ${listing.name} ansehen`}
        >
          Profil ansehen
          <Icon name="arrow" size={19} />
        </Link>
      </div>
    </article>
  );
}

export function ListingGrid({
  listings,
  categories,
  badges = [],
  basePath = "/experten",
}: {
  listings: Listing[];
  categories: Category[];
  badges?: QualityBadge[];
  basePath?: string;
}) {
  return (
    <div className="listing-grid">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          categories={categories}
          href={`${basePath}/${listing.slug}`}
          qualityBadge={badges.find((b) => b.listingId === listing.id)}
        />
      ))}
    </div>
  );
}

export function EmptyState({ isDemo = true, travel = false }: { isDemo?: boolean; travel?: boolean }) {
  return (
    <div className="empty-state">
      <span className="icon-tile">
        <Icon name="search" size={28} />
      </span>
      <h2>Noch kein passender Treffer.</h2>
      <p>
        Versuchen Sie einen anderen Ort oder wählen Sie weniger Filter.
        {isDemo && !travel && " Diese Vorschau enthält acht Beispielbetriebe."}
      </p>
      <Link className="button button-primary" href={travel ? "/unterkuenfte-a-z" : "/experten"}>
        {travel ? "Alle Unterkünfte anzeigen" : isDemo
          ? "Alle Beispielbetriebe anzeigen"
          : "Alle Fachbetriebe anzeigen"}
      </Link>
    </div>
  );
}

export function CategoryGrid({
  categories,
  listings,
}: {
  categories: Category[];
  listings: Listing[];
}) {
  return (
    <div className="category-grid">
      {categories.map((category) => (
        <Link
          className="category-card"
          key={category.id}
          href={`/experten?kategorie=${category.id}`}
        >
          <span className="category-icon">
            <Icon name={category.icon} size={29} />
          </span>
          <h3>{category.name}</h3>
          <span>
            {
              listings.filter((listing) =>
                listing.categoryIds.includes(category.id),
              ).length
            }{" "}
            Beispielbetriebe
          </span>
          <Icon name="arrow" size={18} />
        </Link>
      ))}
    </div>
  );
}
