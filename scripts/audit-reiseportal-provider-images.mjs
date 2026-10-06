// Read-only evidence audit. Input is a read-only Cloud profile/media snapshot;
// this script writes documentation only, never storage, SQL or provider content.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
if (!process.argv[2]) throw new Error('Provide the read-only Cloud profile/media snapshot JSON path');
const profiles = read(process.argv[2]).filter(p => p.legacy_joomla_article_id);
const assets = read('docs/reiseportal-legacy-az-assets.json');
const articles = read('.legacy-reiseportal/raw/articles.json').data;
const companies = read('.legacy-reiseportal/normalized/companies.json').companies;
const cards = read('src/data/reiseportal-travel-provider-images.json');
const legacy = read('src/data/reiseportal-legacy-provider-media.json');
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const countries = { Deutschland: 'deutschland', Österreich: 'oesterreich', Schweiz: 'schweiz', Italien: 'suedtirol-italien' };
const rows = profiles.map(p => {
  const company = companies.find(c => Number(c.legacy.joomla_article_id) === p.legacy_joomla_article_id);
  const article = articles.find(a => Number(a.id) === p.legacy_joomla_article_id)?.attributes;
  if (!company || !article || article.state !== 1 || p.status !== 'approved') throw new Error(`Unexpected source/status: ${p.slug}`);
  const card = cards[p.slug];
  let evidence;
  if (card) {
    if (!existsSync('public' + card.src)) throw new Error(`Missing asset: ${card.src}`);
    const hash = sha('public' + card.src);
    evidence = assets.find(a => a.profile_slug === p.slug && a.decision === 'ASSIGN' && a.sha256 === hash);
    if (!evidence) throw new Error(`No exact provider/hash provenance: ${p.slug}`);
  }
  const selected = p.images[0]?.path ?? card?.src ?? null;
  const sourceMedia = company.media ?? [];
  const decision = selected ? 'EXISTING_OK' : sourceMedia.length ? 'AMBIGUOUS_SKIP' : 'NO_IMAGE_FOUND';
  return {
    profile_id: p.id, slug: p.slug, name: p.display_name, package: p.package,
    joomla_article_id: p.legacy_joomla_article_id, terms: p.terms,
    destination_pages: countries[p.country] ? ['/reiseziele/' + countries[p.country]] : [],
    theme_pages: p.terms.filter(t => t.startsWith('theme:')).map(t => '/mottoreisen/' + t.slice(6)),
    cloud_gallery_count: p.images.length, cloud_logo_present: Boolean(p.logo_path),
    legacy_gallery_count: legacy[p.slug]?.images.length ?? 0,
    source_media_reference_count: sourceMedia.length, selected_image: selected,
    legacy_photo: card ? { ...card, source_url: evidence.source_url, source_field: evidence.field, sha256: evidence.sha256 } : null,
    decision,
    note: p.images.length ? 'Bestehende gespeicherte Galerie hat Vorrang; nicht neu importieren oder bereinigen.' : card ?
      'Visuell geprüftes Anbieter-/Umgebungsfoto aus bestehendem zentralem Medienbestand; keine Dateikopie.' : sourceMedia.length ?
      'Nur Logos bzw. Angebots-/Webseitengrafiken belegt; kein geeignetes Fotokartenbild. Bewusst übersprungen.' :
      'Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen.',
  };
});
if (rows.length !== 58 || new Set(rows.map(r => r.profile_id)).size !== rows.length) throw new Error('Unexpected provider inventory');
const summary = {
  audited: rows.length, destinations: rows.filter(r => r.destination_pages.length).length,
  themes: rows.filter(r => r.theme_pages.length).length,
  existing_ok: rows.filter(r => r.decision === 'EXISTING_OK').length,
  import_confirmed: 0, no_image_found: rows.filter(r => r.decision === 'NO_IMAGE_FOUND').length,
  ambiguous_skip: rows.filter(r => r.decision === 'AMBIGUOUS_SKIP').length,
  new_storage_objects: 0, new_media_rows: 0,
  reused_provider_photos: rows.filter(r => r.selected_image).length,
};
writeFileSync('docs/reiseportal-provider-image-audit.json', JSON.stringify({ date: '2026-10-06', code_basis: '1e868124de2158cd4ba3cac05430d1fcb16cc321', summary, providers: rows }, null, 2) + '\n');
console.log(JSON.stringify(summary));
