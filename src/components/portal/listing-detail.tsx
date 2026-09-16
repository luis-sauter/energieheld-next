import type { Category, Listing } from "@/types/portal";
import { Badge } from "./listings";
import { Icon } from "./icon";
import { ImageGallery } from "./image-gallery";

export function ContactSection({ listing }: { listing: Listing }) {
  return (
    <section className="contact-card" aria-labelledby="contact-title">
      <h2 id="contact-title">Kontakt & Standort</h2>
      <p className="location">
        <Icon name="pin" />
        {listing.location.postalCode} {listing.location.city}
        <br />
        {listing.location.region}, {listing.location.country}
      </p>
      <hr />
      <dl>
        <dt>Telefon</dt>
        <dd>{listing.contact.phone}</dd>
        <dt>E-Mail</dt>
        <dd>{listing.contact.email}</dd>
        <dt>Website</dt>
        <dd>{listing.contact.website.replace("https://", "")}</dd>
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
          <a
            className="button button-primary"
            href={`mailto:${listing.contact.email}`}
          >
            Kontakt aufnehmen
          </a>
          <a
            className="text-link"
            href={listing.contact.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Website besuchen
          </a>
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
          aria-label={`Beispiellogo ${listing.name}`}
        >
          {listing.initials}
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
          <p className="location">
            <Icon name="pin" size={18} />
            {listing.location.city}, {listing.location.region}
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <ImageGallery images={listing.images} />
          <section className="detail-section">
            <p className="eyebrow">Ein guter erster Eindruck</p>
            <h2>Über {listing.name}</h2>
            <p>{listing.description}</p>
          </section>
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
          {qualityArea}
        </div>
        <aside>
          <ContactSection listing={listing} />
        </aside>
      </div>
    </>
  );
}
