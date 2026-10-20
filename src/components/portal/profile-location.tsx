import { formatLocation, type googleMapsLocation } from '@/lib/listings';
import type { Listing } from '@/types/portal';
import { Icon } from './icon';
import styles from './profile-location.module.css';

// Shared by the design preview, public profiles and their existing admin preview.
// The caller retains the existing demo/map-visibility guards and address override.
export function ProfileLocation({ name, location, map, isDemo = false }: {
  name: string;
  location: Listing['location'];
  map: ReturnType<typeof googleMapsLocation>;
  isDemo?: boolean;
}) {
  const titleId = 'profile-location-title';
  const cityQuery = [location.postalCode, location.city, location.country].filter(Boolean).join(' ');
  return <section className={['profile-location', styles.location].filter(Boolean).join(' ')} aria-labelledby={titleId}>
    <div className={styles.details}>
      <p className={styles.eyebrow}>Standort</p>
      <h2 id={titleId}>{map?.query || formatLocation(location) || 'Standort noch nicht angegeben'}</h2>
      <p>{map
        ? map.precise ? 'Kartenansicht zur angegebenen Unternehmensadresse.' : 'Ortsübersicht · keine genaue Firmenposition.'
        : isDemo ? 'Beispielstandort · keine genaue Firmenposition' : 'Die angegebene Region des Unternehmens. Eine genaue Kartenposition ist hier nicht hinterlegt.'}</p>
      {map ? <a className={styles.mapLink} href={map.searchUrl} target="_blank" rel="noopener noreferrer">
        <Icon name="pin" />In Google Maps öffnen ↗
      </a> : !isDemo && location.city && <a className={styles.mapLink}
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cityQuery)}`}
        target="_blank" rel="noopener noreferrer"><Icon name="pin" />Ort auf Google Maps ansehen ↗</a>}
    </div>
    {map ? <iframe title={`Google Maps – ${map.precise ? 'Adresse' : 'Ortsübersicht'}: ${map.query} – ${name}`}
      src={map.embedUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      : <div className={styles.placeholder} aria-hidden="true"><Icon name="pin" size={44} /></div>}
  </section>;
}
