import type { Category, Listing } from "@/types/portal";
import { formatLocation } from "@/lib/listings";
import { Badge } from "./listings";
import { CompanyLogo } from "./company-image";
import { Icon } from "./icon";
import { ImageGallery } from "./image-gallery";

function safeWebsite(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function ContactSection({ listing }: { listing: Listing }) {
  const website = safeWebsite(listing.contact.website);
  const location = formatLocation(listing.location);
  return (
    <section className="contact-card" aria-labelledby="contact-title">
      <h2 id="contact-title">Kontakt & Standort</h2>
      {location && (
        <p className="location">
          <Icon name="pin" />
          {location}
        </p>
      )}
      <hr />
      <dl>
        {listing.contact.phone && (
          <>
            <dt>Telefon</dt>
            <dd>{listing.contact.phone}</dd>
          </>
        )}
        {listing.contact.email && (
          <>
            <dt>E-Mail</dt>
            <dd>{listing.contact.email}</dd>
          </>
        )}
        {website && (
          <>
            <dt>Website</dt>
            <dd>{website}</dd>
          </>
        )}
      </dl>
      {listing.isDemo ? (
        <>
          <button className="button button-primary" disabled>
            <Icon name="mail" size={18} />
            Kontakt aufnehmen
          </button>
          <p className="small muted">
            Beispielprofil: Kontaktdaten sind fiktiv. Kontaktaufnahme ist in
            dieser Vorschau nicht verfügbar.
          </p>
        </>
      ) : (
        <>
          {listing.contact.email && (
            <a
              className="button button-primary"
              href={`mailto:${listing.contact.email}`}
            >
              Kontakt aufnehmen
            </a>
          )}
          {website && (
            <a
              className="text-link"
              href={website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Website besuchen
            </a>
          )}
        </>
      )}
    </section>
  );
}

export function ListingDetail({
  listing,
  categories,
  qualityArea,
  headingLevel = 1,
}: {
  listing: Listing;
  categories: Category[];
  qualityArea?: React.ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <>
      <div className="detail-heading">
        <div
          className="detail-logo"
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
        <div>
          <div className="inline-tags">
            {listing.isDemo && <Badge>Beispielprofil</Badge>}
            {categories
              .filter((c) => listing.categoryIds.includes(c.id))
              .map((c) => (
                <span key={c.id}>{c.name}</span>
              ))}
          </div>
          <Heading className="detail-title">{listing.name}</Heading>
          <p className="detail-tagline">{listing.tagline}</p>
          {formatLocation(listing.location) && (
            <p className="location">
              <Icon name="pin" size={18} />
              {formatLocation(listing.location)}
            </p>
          )}
        </div>
      </div>
      <div className="detail-grid">
        <div>
          {listing.images.length > 0 && (
            <ImageGallery
              key={listing.images.map((image) => image.src).join("|")}
              images={listing.images}
              isDemo={listing.isDemo}
            />
          )}
          {listing.description && (
            <section className="detail-section">
              <p className="eyebrow">Ein guter erster Eindruck</p>
              <h2>Über {listing.name}</h2>
              <p>{listing.description}</p>
            </section>
          )}
          {listing.businessAreas && (
            <section className="detail-section">
              <h2>Branchen & Tätigkeitsbereiche</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{listing.businessAreas}</p>
            </section>
          )}
          {listing.services.length > 0 && (
            <section className="detail-section">
              <h2>Leistungen im Überblick</h2>
              <ul className="service-list">
                {listing.services.map((service) => (
                  <li key={service}>
                    <Icon name="check" />
                    {service}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {qualityArea}
        </div>
        <aside>
          <ContactSection listing={listing} />
        </aside>
      </div>
    </>
  );
}
