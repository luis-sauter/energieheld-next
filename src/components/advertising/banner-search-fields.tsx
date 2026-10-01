import type { BannerSearchMetadata, BannerSearchTerm } from '@/lib/banner-search-metadata';
import styles from './banner-search-fields.module.css';
const dimensions: Record<string, string> = { theme: 'Reiseart', audience: 'Reisende', accommodation: 'Unterkunft', feature: 'Merkmal' };
export function BannerSearchFields({ value, terms, onChange, includeName = true }: {
  value: BannerSearchMetadata; terms: BannerSearchTerm[]; onChange: (value: BannerSearchMetadata) => void; includeName?: boolean;
}) {
  return <>
    {includeName && <label>Name / Bezeichnung<input name="headline" required maxLength={100} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} /></label>}
    <label>PLZ<input name="banner_postal_code" autoComplete="postal-code" maxLength={20} value={value.postal_code} onChange={e => onChange({ ...value, postal_code: e.target.value })} /></label>
    <label>Ort<input name="banner_city" autoComplete="address-level2" maxLength={120} value={value.city} onChange={e => onChange({ ...value, city: e.target.value })} /></label>
    <fieldset className={styles.categories}><legend>Kategorien</legend>
      <p>Beschreiben den Bannerinhalt – unabhängig vom gebuchten Bereich. Fehlende Angaben dürfen leer bleiben.</p>
      {terms.map(term => <label key={term.term_key}><input type="checkbox" name="banner_terms" value={term.term_key} checked={value.term_keys.includes(term.term_key)}
        onChange={e => onChange({ ...value, term_keys: e.target.checked ? [...value.term_keys, term.term_key] : value.term_keys.filter(key => key !== term.term_key) })} />
        {term.label} · {dimensions[term.dimension] ?? 'Kategorie'}</label>)}
    </fieldset>
  </>;
}
