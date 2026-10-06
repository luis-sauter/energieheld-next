import type { BannerSearchMetadata, BannerSearchTerm, BannerAdvertiserOption } from '@/lib/banner-search-metadata';
import { destinations } from '@/data/reiseportal-discovery';
import { publicTravelLabel } from '@/lib/travel-presentation';
import styles from './banner-search-fields.module.css';
const dimensions: Record<string, string> = { theme: 'Reiseart', audience: 'Reisende', accommodation: 'Unterkunft', feature: 'Merkmal' };
export function BannerSearchFields({ value, terms, onChange, advertisers = [], includeName = true }: {
  advertisers?: BannerAdvertiserOption[]; value: BannerSearchMetadata; terms: BannerSearchTerm[]; onChange: (value: BannerSearchMetadata) => void; includeName?: boolean;
}) {
  const audienceKeys = ['audience:mit-hund', 'audience:familie', 'audience:paar'];
  const audiences = audienceKeys.flatMap(key => terms.filter(term => term.term_key === key));
  const categories = terms.filter(term => !audienceKeys.includes(term.term_key));
  const toggleTerm = (key: string, checked: boolean) => onChange({ ...value,
    term_keys: checked ? Array.from(new Set([...value.term_keys, key])) : value.term_keys.filter(entry => entry !== key) });
  return <>
    <h3>Suchzuordnung</h3>
    <p>Diese Angaben steuern, bei welchen Unterkunftssuchen die Anzeige zusätzlich erscheint. Sie ändern nicht die gebuchten Werbeplätze.</p>
    <label>Werbekunde / Firmenprofil<select name="banner_advertiser" value={value.advertiser_key ?? ''} onChange={e => {
      const selected = advertisers.find(row => row.key === e.target.value);
      onChange({ ...value, advertiser_key: e.target.value, advertiser_name: selected?.name ?? '', advertiser_profile_id: selected?.profile_id ?? null });
    }}><option value="">Neuer oder eigenständiger Werbekunde</option>{advertisers.map(row => <option key={row.key} value={row.key}>{row.name}{row.profile_id ? ' · Firmenprofil' : ''}</option>)}</select></label>
    <input type="hidden" name="banner_profile_id" value={value.advertiser_profile_id ?? ''} />
    <label>Bezeichnung des Werbekunden<input name="banner_advertiser_name" maxLength={120} value={value.advertiser_name ?? ''} onChange={e => onChange({ ...value, advertiser_name: e.target.value })} /></label>
    <label>Art der Anzeige<select name="banner_commercial" value={String(value.commercial !== false)} onChange={e => onChange({ ...value, commercial: e.target.value === 'true' })}>
      <option value="true">Externer Werbekunde</option><option value="false">Portalinterne Reiseinspiration / Eigenwerbung</option></select></label>
    <label className={styles.check}><input type="checkbox" name="banner_primary" value="true" checked={Boolean(value.primary_creative)} onChange={e => onChange({ ...value, primary_creative: e.target.checked })} />Allgemeiner Hauptbanner dieses Werbekunden</label>
    <fieldset className={styles.categories}><legend>Land / Reiseziel</legend>{destinations.map(entry => <label key={entry.slug}><input name="banner_destinations" type="checkbox" value={entry.slug} checked={value.destination_slugs?.includes(entry.slug) ?? false} onChange={e => onChange({ ...value, destination_slugs: e.target.checked ? [...(value.destination_slugs ?? []),entry.slug] : (value.destination_slugs ?? []).filter(slug => slug !== entry.slug) })} />{entry.title}</label>)}</fieldset>
    <label>Region<input name="banner_region" maxLength={120} value={value.region ?? ''} onChange={e => onChange({ ...value, region: e.target.value })} /></label>
    {includeName && <label>Name / Bezeichnung<input name="headline" required maxLength={100} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} /></label>}
    <label>PLZ<input name="banner_postal_code" autoComplete="postal-code" maxLength={20} value={value.postal_code} onChange={e => onChange({ ...value, postal_code: e.target.value })} /></label>
    <label>Ort<input name="banner_city" autoComplete="address-level2" maxLength={120} value={value.city} onChange={e => onChange({ ...value, city: e.target.value })} /></label>
    <fieldset className={styles.categories}><legend>Mit wem? · Zielgruppen</legend>
      <p>Nur passende Zielgruppen dieses Bannerinhalts auswählen. Anzeigen desselben Werbekunden werden weiterhin zusammengefasst.</p>
      {audiences.map(term => <label key={term.term_key}><input type="checkbox" name="banner_terms" value={term.term_key}
        checked={value.term_keys.includes(term.term_key)} onChange={e => toggleTerm(term.term_key, e.target.checked)} />
        {publicTravelLabel(term.term_key, term.label)}</label>)}
    </fieldset>
    <details className={styles.disclosure}><summary>Kategorien · {value.term_keys.filter(key => !audienceKeys.includes(key)).length} ausgewählt</summary>
    <fieldset className={styles.categories}><legend>Kategorien auswählen</legend>
      <p>Beschreiben den Bannerinhalt – unabhängig vom gebuchten Bereich. Fehlende Angaben dürfen leer bleiben.</p>
      {categories.map(term => <label key={term.term_key}><input type="checkbox" name="banner_terms" value={term.term_key} checked={value.term_keys.includes(term.term_key)}
        onChange={e => toggleTerm(term.term_key, e.target.checked)} />
        {publicTravelLabel(term.term_key, term.label)} · {dimensions[term.dimension] ?? 'Kategorie'}</label>)}
    </fieldset></details>
  </>;
}
