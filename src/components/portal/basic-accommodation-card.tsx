import type {BasicContact} from '@/lib/basic-contact';
import {Icon} from './icon';
import styles from './basic-accommodation-card.module.css';
import {NewPlacementBadge} from './new-placement-badge';
export function BasicAccommodationCard({entry}:{entry:Omit<BasicContact,'kind'>}) {
  const labels:Record<string,string>={DE:'Deutschland',AT:'Österreich',CH:'Schweiz',IT:'Italien'};
  const country=labels[entry.address.country]??entry.address.country;
  return <article className={styles.card} data-basic-contact={entry.id}>
    <div className={styles.home} aria-hidden="true"><Icon name="home" size={36}/></div>
    <h3 className={styles.name}>{entry.name}<NewPlacementBadge id={entry.id}/></h3>
    <div className={styles.contact}>
      <p className={styles.address}><Icon name="pin" size={15}/><span>{[[entry.address.street,entry.address.houseNumber].filter(Boolean).join(' '),[entry.address.postalCode,entry.address.city].filter(Boolean).join(' '),entry.address.region,country].filter(Boolean).join(', ')}</span></p>
      <a className={styles.phone} href={`tel:${entry.phone}`}><Icon name="phone" size={15}/><span>{entry.phone}</span></a>
    </div>
  </article>;
}
