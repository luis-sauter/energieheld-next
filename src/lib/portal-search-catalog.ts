import { destinations, travelThemes } from '../data/reiseportal-discovery';
import { mottoEditorial } from '../data/motto-editorial';
import pages from '../data/generated/public-search-pages.json';
import type { SearchDocument } from './portal-search-values';

export function portalSearchCatalog(): SearchDocument[] {
  return [
    ...pages.map(page => ({ id: page.url, type: 'page' as const, ...page })),
    ...travelThemes.map(entry => ({ id: entry.slug, type: 'theme' as const, title: entry.title,
      body: `${mottoEditorial[entry.slug].intro} ${mottoEditorial[entry.slug].alt} Passende Unterkünfte Alle passenden Unterkünfte ansehen`, url: `/mottoreisen/${entry.slug}` })),
    ...destinations.map(entry => ({ id: entry.slug, type: 'destination' as const, title: entry.title,
      body: `${entry.intro} ${entry.stayHeading ?? "Passende Unterkünfte"} ${entry.alt} Passende Unterkünfte Alle passenden Unterkünfte ansehen`, url: `/reiseziele/${entry.slug}` })),
  ];
}
