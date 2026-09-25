import type { Category, Listing } from "@/types/portal";
import { formatLocation, googleMapsLocation } from "@/lib/listings";
import { Badge } from "./listings";
import { CompanyLogo } from "./company-image";
import { Icon } from "./icon";
import { ImageGallery } from "./image-gallery";
import { QualitySeal } from "@/components/quality/quality-seal";

export type InlineProfileFields = Partial<Record<
  "display_name" | "tagline" | "description" | "business_areas" |
  "phone" | "public_email" | "website" | "street" |
  "postal_code" | "city" | "region", React.ReactNode
>>;

function safeWebsite(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function ContactSection({
  listing,
  contactAction,
  logoEditor,
  inlineFields,
}: {
  listing: Listing;
  contactAction?: React.ReactNode;
  logoEditor?: React.ReactNode;
  inlineFields?: InlineProfileFields;
}) {
  const website = safeWebsite(listing.contact.website);
  const location = formatLocation(listing.location);
  const phone = listing.contact.phone.replace(/[^+0-9]/g, "");
  return (
    <section className="contact-card" aria-labelledby="contact-title">
      <h2 id="contact-title">Kontakt & Standort</h2>
      {logoEditor ?? (
        <div
          className="contact-logo"
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
      )}
      {listing.contact.person && (
        <p>Ansprechpartner: {listing.contact.person}</p>
      )}
      {inlineFields?.street ?? (listing.location.street && <p>{listing.location.street}</p>)}
      {inlineFields ? (
        <div className="inline-location-fields">
          {inlineFields.postal_code}{inlineFields.city}{inlineFields.region}
        </div>
      ) : location && (
        <p className="location">
          <Icon name="pin" />
          {location}
        </p>
      )}
      <p className="contact-company-name">{listing.name}</p>
      <hr />
      <dl>
        {(inlineFields?.phone || listing.contact.phone) && (
          <>
            <dt>Telefon</dt>
            <dd>
              {inlineFields?.phone ?? (listing.isDemo || !/\d{3,}/.test(phone) ? (
                listing.contact.phone
              ) : (
                <a href={`tel:${phone}`}>{listing.contact.phone}</a>
              ))}
            </dd>
          </>
        )}
        {(inlineFields?.public_email || listing.contact.email) && (
          <>
            <dt>E-Mail</dt>
            <dd>
              {inlineFields?.public_email ?? (listing.isDemo ? (
                listing.contact.email
              ) : (
                <a href={`mailto:${listing.contact.email}`}>
                  {listing.contact.email}
                </a>
              ))}
            </dd>
          </>
        )}
        {(inlineFields?.website || website) && (
          <>
            <dt>Website</dt>
            <dd>
              {inlineFields?.website ?? (listing.isDemo ? (
                website
              ) : (
                <a href={website ?? undefined} target="_blank" rel="noopener noreferrer">
                  {website}
                </a>
              ))}
            </dd>
          </>
        )}
      </dl>
      {inlineFields ? null : listing.isDemo ? (
        <>
          <button className="button button-primary" disabled>
            <Icon name="mail" size={18} />
            Kontakt aufnehmen
          </button>
          <p className="small muted">
            {listing.isPreview
              ? "Für dieses Testprofil sind keine Kontaktdaten hinterlegt. Kontaktaufnahme ist nicht verfügbar."
              : "Beispielprofil: Kontaktdaten sind fiktiv. Kontaktaufnahme ist in dieser Vorschau nicht verfügbar."}
          </p>
        </>
      ) : (
        <>
          {contactAction ??
            (listing.contact.email && (
              <a
                className="button button-primary"
                href={`mailto:${listing.contact.email}`}
              >
                Kontakt aufnehmen
              </a>
            ))}
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
  presentation,
  logoEditor,
  galleryEditor,
  adminAction,
  inlineFields,
  aboutHeading,
  businessHeading,
  aboutHeadingEditor,
  businessHeadingEditor,
  contentBlocks,
  contactAction,
  showMap = false,
  showVerification = true,
}: {
  listing: Listing;
  categories: Category[];
  showMap?: boolean;
  showVerification?: boolean;
  qualityArea?: React.ReactNode;
  headingLevel?: 1 | 2;
  presentation?: "company";
  logoEditor?: React.ReactNode;
  galleryEditor?: React.ReactNode;
  adminAction?: React.ReactNode;
  inlineFields?: InlineProfileFields;
  aboutHeading?: string;
  businessHeading?: string;
  aboutHeadingEditor?: React.ReactNode;
  businessHeadingEditor?: React.ReactNode;
  contentBlocks?: React.ReactNode;
  contactAction?: React.ReactNode;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const map =
    showMap && !listing.isDemo ? googleMapsLocation(listing.location) : null;
  const content = (
    <>
      <div className="detail-heading">
        <div>
          <Heading className="detail-title">{inlineFields?.display_name ?? listing.name}</Heading>
          <div className="inline-tags">
            {listing.isDemo && <Badge>{listing.demoLabel ?? "Beispielprofil"}</Badge>}
            {categories
              .filter((c) => listing.categoryIds.includes(c.id))
              .map((c) => (
                <span key={c.id}>{c.name}</span>
              ))}
          </div>
          {inlineFields?.tagline ? <div className="detail-tagline">{inlineFields.tagline}</div> : <p className="detail-tagline">{listing.tagline}</p>}
          <a className="text-link profile-contact-link" href="#contact-title">
            Kontakt & Standort ansehen ↓
          </a>
          {formatLocation(listing.location) && (
            <p className="location">
              <Icon name="pin" size={18} />
              {formatLocation(listing.location)}
            </p>
          )}
        </div>
        {showVerification && presentation === "company" &&
          !listing.isDemo &&
          listing.verification?.status === "verified" && (
            <QualitySeal note={listing.verification.public_note} prominent />
          )}
        {adminAction}
      </div>
      <div className="profile-information">
        <ContactSection
          listing={listing}
          contactAction={contactAction}
          logoEditor={logoEditor}
          inlineFields={inlineFields}
        />
        <section className="location-module" aria-label="Standort">
          {map ? (
            <iframe
              className="location-map"
              title={`Google Maps – ${map.precise ? "Adresse" : "Ortsübersicht"}: ${map.query}`}
              src={map.embedUrl}
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <div className="location-illustration" aria-hidden="true">
              <Icon name="pin" size={44} />
            </div>
          )}
          <div>
            <p className="eyebrow">Standort</p>
            <h2>
              {map?.query ||
                formatLocation(listing.location) ||
                "Standort noch nicht angegeben"}
            </h2>
            <p>
              {map
                ? map.precise
                  ? "Kartenansicht zur angegebenen Unternehmensadresse."
                  : "Ortsübersicht · keine genaue Firmenposition."
                : listing.isDemo
                  ? "Beispielstandort · keine genaue Firmenposition"
                  : "Die angegebene Region des Unternehmens. Eine genaue Kartenposition ist hier nicht hinterlegt."}
            </p>
            {map ? (
              <a
                className="text-link"
                href={map.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                In Google Maps öffnen ↗
              </a>
            ) : (
              !listing.isDemo &&
              listing.location.city && (
                <a
                  className="text-link"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={
                    "https://www.google.com/maps/search/?api=1&query=" +
                    encodeURIComponent(
                      [
                        listing.location.postalCode,
                        listing.location.city,
                        listing.location.country,
                      ]
                        .filter(Boolean)
                        .join(" "),
                    )
                  }
                >
                  Ort auf Google Maps ansehen ↗
                </a>
              )
            )}
          </div>
        </section>
      </div>
      <div className="detail-grid">
        <div>
          {(listing.description || inlineFields?.description) && (
            <section className="detail-section">
              {!presentation && (
                <p className="eyebrow">Ein guter erster Eindruck</p>
              )}
              {aboutHeadingEditor ?? <h2>{aboutHeading ?? `Über ${listing.name}`}</h2>}
              {inlineFields?.description ?? <p>{listing.description}</p>}
            </section>
          )}
        </div>
      </div>
      {contentBlocks && <div className="profile-content-canvas">{contentBlocks}</div>}
      <div className="detail-grid">
        <div>
          {galleryEditor ??
            (listing.images.length > 0 && (
              <ImageGallery
                key={listing.images.map((image) => image.src).join("|")}
                images={listing.images}
                isDemo={listing.isDemo}
              />
            ))}
          {(listing.businessAreas || inlineFields?.business_areas) && (
            <section className="detail-section">
              {businessHeadingEditor ?? <h2>
                {presentation === "company"
                  ? businessHeading ?? "Tätigkeitsbereiche"
                  : "Branchen & Tätigkeitsbereiche"}
              </h2>}
              {inlineFields?.business_areas ?? <p style={{ whiteSpace: "pre-wrap" }}>{listing.businessAreas}</p>}
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
      </div>
    </>
  );
  return presentation === "company" ? (
    <div className="company-profile">{content}</div>
  ) : (
    content
  );
}
