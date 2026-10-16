import type {BasicContact} from '@/lib/basic-contact';
import styles from './basic-accommodation-card.module.css';
export function BasicAccommodationCard({entry}:{entry:Omit<BasicContact,'kind'>}) {
  const labels:Record<string,string>={DE:'Deutschland',AT:'Österreich',CH:'Schweiz',IT:'Italien'};
  const country=labels[entry.address.country]??entry.address.country;
  return <article className={styles.card} data-basic-contact={entry.id}>
    <h3>{entry.name}</h3>
    <p>{[[entry.address.street,entry.address.houseNumber].filter(Boolean).join(' '),[entry.address.postalCode,entry.address.city].filter(Boolean).join(' '),entry.address.region,country].filter(Boolean).join(', ')}</p>
    <a href={`tel:${entry.phone}`}>{entry.phone}</a>
  </article>;
}
