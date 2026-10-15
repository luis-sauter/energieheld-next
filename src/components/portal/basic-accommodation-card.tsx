import type {BasicContact} from '@/lib/basic-accommodation-pilot';
import styles from './basic-accommodation-card.module.css';
// Prepared for isolated local review only; no public route imports this card yet.
export function BasicAccommodationCard({entry}:{entry:BasicContact}) {
  const labels:Record<string,string>={DE:'Deutschland',AT:'Österreich',CH:'Schweiz',IT:'Italien'};
  const country=labels[entry.address.country]??entry.address.country;
  return <article className={styles.card}>
    <h3>{entry.name}</h3>
    <p>{[entry.address.street,[entry.address.postalCode,entry.address.city].filter(Boolean).join(' '),entry.address.region,country].filter(Boolean).join(', ')}</p>
    <a href={`tel:${entry.phone}`}>{entry.phone}</a>
  </article>;
}
