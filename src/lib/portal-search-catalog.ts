import { destinations, travelThemes } from '../data/reiseportal-discovery';
import { mottoEditorial } from '../data/motto-editorial';
import pages from '../data/generated/public-search-pages.json';
import type { SearchDocument } from './portal-search-values';

export function portalSearchCatalog(): SearchDocument[] {
  return [
    ...pages.map(page => ({ id: page.url, type: 'page' as const, ...page })),
    ...travelThemes.map(entry => ({ id: entry.slug, type: 'theme' as const, title: entry.title,
      body: [mottoEditorial[entry.slug].intro, mottoEditorial[entry.slug].heading, mottoEditorial[entry.slug].lead,
        ...mottoEditorial[entry.slug].sections.flatMap(section => [section.title, section.text]), 'Passende Unterkünfte Alle passenden Unterkünfte ansehen'].join(' '), url: `/mottoreisen/${entry.slug}` })),
    ...destinations.map(entry => ({ id: entry.slug, type: 'destination' as const, title: entry.title,
      body: `${entry.intro} Passende Unterkünfte Alle passenden Unterkünfte ansehen`, url: `/reiseziele/${entry.slug}` })),
  ];
}
