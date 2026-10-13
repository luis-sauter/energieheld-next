import Image from 'next/image';
import Link from './navigation-link';
import { ImageGallery } from './image-gallery';
import { InquiryDialog } from '@/components/leads/inquiry-dialog';
import { ProfileEditorialContent, TextImageSection } from './profile-content-blocks';
import { ThemeScroller } from './theme-scroller';
import { TravelThemeIcon } from './travel-theme-icon';
import { Icon } from './icon';
import { travelThemes } from '@/data/reiseportal-discovery';
import { discoveryShortcutHref } from '@/lib/discovery-shortcuts';
import { profileTravelSignals } from '@/lib/travel-presentation';
import { formatLocation, googleMapsLocation } from '@/lib/listings';
import { splitProfileContent, type ProfileContentBlock } from '@/lib/profile-content';
import { normalizeTextBlockLayout } from '@/lib/content-block-layout';
import type { Listing } from '@/types/portal';
import styles from './profile-design-preview.module.css';

export function ProfileDesignPreview({ listing, blocks = [] }: { listing: Listing; blocks?: ProfileContentBlock[] }) {
  const map = googleMapsLocation(listing.location);
  const content = splitProfileContent(blocks, listing.name);
  // Only this prototype starts with the fireplace shown in the reference.
  // Reordering a copy never changes the canonical gallery.
  const fireplace = listing.images.find(image => image.id === '554e4fe8-bf9d-48fe-b6a9-c8a791393c8a');
  const gallery = fireplace ? [fireplace, ...listing.images.filter(image => image !== fireplace)] : listing.images;
  const atmosphere = listing.images.find(image => image.id === '8a30bccc-94e4-4b57-9f20-668a8e354c57') ?? listing.images[1];
  // An existing CMS image/flow wins. Otherwise pair the original about text
  // with an existing gallery photo for this view only, without persisting blocks.
  const editorialItems = content.items.map(item => item.kind === 'about' && !item.imageBlock && atmosphere ? {
    ...item, layout: { ...item.layout, width_percent: 65, offset_percent: 0 },
    pairLayout: normalizeTextBlockLayout({ ...item.layout, ...item.pairLayout, width_percent: 100, offset_percent: 0 }),
    imageBlock: { id: 'preview-existing-photo', profile_id: listing.id, type: 'image_grid' as const, slot: null, sort_order: 0,
      content: { text: '' }, config: { columns: 1 as const, width_percent: 35, offset_percent: 65 },
      images: [{ id: atmosphere.id ?? 'existing-photo', block_id: 'preview-existing-photo', src: atmosphere.src, alt_text: atmosphere.alt, sort_order: 0 }] },
  } : item);
  const signals = profileTravelSignals(listing.travelTermKeys, 4);
  return <main id="hauptinhalt" className={styles.preview}>
    <div className="container">
      <p className={styles.notice}>Isolierte Designvorschau · bestehende Unternehmensprofile bleiben unverändert</p>
      <nav className={styles.breadcrumbs} aria-label="Brotkrümelnavigation"><Link href="/">Startseite</Link><span>›</span><Link href="/unterkuenfte-a-z">Unterkünfte A–Z</Link><span>›</span><span>{listing.name}</span></nav>
      <header className={styles.heading}>
        <h1>{listing.name}</h1>
        <ul className={styles.tags} aria-label="Reiseinteressen">{signals.map(signal => <li key={signal.key}><Link href={discoveryShortcutHref(signal.key.startsWith('audience:') ? 'audience' : 'theme', signal.key.split(':')[1])}><TravelThemeIcon slug={signal.icon} />{signal.label}</Link></li>)}</ul>
        {listing.tagline && <p className={styles.subtitle}>{listing.tagline}</p>}
        <p className={styles.address}><Icon name="pin" />{formatLocation(listing.location)}</p>
      </header>
      <div className={styles.hero}>
        <div className={styles.gallery}><ImageGallery images={gallery} isDemo={false} autoplay={false} /></div>
        <aside className={styles.contact} aria-label="Kontakt und Standort">
          <h2>Kontakt &amp; Standort</h2>
          {listing.logo && <Image className={styles.logo} src={listing.logo.src} alt={listing.logo.alt} width={100} height={100} unoptimized />}
          <p className={styles.street}>{listing.location.street}</p><p className={styles.address}><Icon name="pin" />{formatLocation(listing.location)}</p>
          <div className={styles.contactDetails}><h3>{listing.name}</h3>
            {listing.contact.phone && <a href={`tel:${listing.contact.phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" />{listing.contact.phone}</a>}
            {listing.contact.email && <a href={`mailto:${listing.contact.email}`}><Icon name="mail" />{listing.contact.email}</a>}
            {listing.contact.website && <a href={listing.contact.website} target="_blank" rel="noopener noreferrer"><Icon name="globe" />{listing.contact.website}</a>}
          </div>
          <InquiryDialog profileId={listing.id} companyName={listing.name} />
          {listing.contact.website && <a className={styles.website} href={listing.contact.website} target="_blank" rel="noopener noreferrer">Website besuchen <span aria-hidden="true">↗</span></a>}
        </aside>
      </div>
      {map && <section className={styles.location} aria-labelledby="preview-location-title"><div>
        <p className={styles.eyebrow}>Standort</p><h2 id="preview-location-title">{map.query}</h2><p>Kartenansicht zur angegebenen Unternehmensadresse.</p>
        <a className={styles.mapLink} href={map.searchUrl} target="_blank" rel="noopener noreferrer"><Icon name="pin" />In Google Maps öffnen ↗</a>
      </div><iframe title={`Google Maps – ${listing.name}`} src={map.embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></section>}
      <section className={styles.editorial} aria-label="Unternehmensbeschreibung"><p className={styles.eyebrow}>Über die Unterkunft</p>
        {blocks.length ? <ProfileEditorialContent items={editorialItems} listing={listing} /> : <>
          <TextImageSection heading={<h2>{content.aboutHeading}</h2>}
            text={<div className={styles.description}>{listing.description.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
            image={atmosphere ? <div className={styles.atmosphere}><Image src={atmosphere.src} alt={atmosphere.alt} fill unoptimized sizes="(max-width: 700px) 90vw, 35vw" loading="lazy" /></div> : null}
            textWidth={65} imageWidth={35} imageFirst={false} flow="standard" />
          {listing.businessAreas && <div className={styles.description}><h2>{content.businessHeading}</h2><p>{listing.businessAreas}</p></div>}
        </>}
        <details className={styles.moreImages}><summary>Weitere Einblicke in die Unterkunft</summary><div>{listing.images.filter(image => image !== atmosphere).map(image => <figure key={image.src}><Image src={image.src} alt={image.alt} width={640} height={480} unoptimized loading="lazy" /><figcaption>{image.alt}</figcaption></figure>)}</div></details>
      </section>
      <section className={styles.inspiration} aria-labelledby="preview-inspiration-title">
        <p className={styles.eyebrow}>Inspiration für Ihre Auszeit</p><h2 id="preview-inspiration-title">Hier beginnt Ihre nächste Reiseidee</h2><p>Diese Unterkunft hat Sie inspiriert? Entdecken Sie passende Themen und mehr aus der Region.</p>
        <ThemeScroller count={travelThemes.length} label="Reiseideen" edgeNavigation>
          {travelThemes.map(theme => <Link className={styles.themeCard} key={theme.slug} href={discoveryShortcutHref('theme', theme.slug)}><div className={styles.themePhoto}><Image src={`/reiseportal/redesign/mottoreisen/${theme.slug}.webp`} alt="" fill sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 28vw" loading="lazy" /></div><span className={styles.themeIcon}><TravelThemeIcon slug={theme.slug} /></span><strong>{theme.title}</strong></Link>)}
        </ThemeScroller>
      </section>
      <Link className={styles.back} href="/unterkuenfte-a-z">← Zurück zu Unterkünfte A–Z</Link>
    </div>
  </main>;
}
