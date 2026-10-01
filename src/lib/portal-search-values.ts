export const searchTypes = { accommodation: 'Unterkunft', theme: 'Mottoreise', destination: 'Reiseziel', page: 'Seite', ad: 'Anzeige' } as const;
export type SearchType = keyof typeof searchTypes;
export type SearchHit = { id: string; type: SearchType; title: string; excerpt: string; url: string; rank: number; external?: boolean; context?: string };
export type SearchDocument = { id: string; type: SearchType; title: string; body: string; url: string; context?: string };
export const SEARCH_QUERY_LIMIT = 160;
export const SEARCH_PAGE_SIZE = 20;
export function normalizeSearch(value: string) {
  return value.toLocaleLowerCase('de-DE').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function searchQuery(value: unknown) { return typeof value === 'string' ? value.trim().slice(0, SEARCH_QUERY_LIMIT) : ''; }
export function searchType(value: unknown): SearchType | undefined { return typeof value === 'string' && Object.hasOwn(searchTypes, value) ? value as SearchType : undefined; }
const stopwords = new Set(['der', 'die', 'das', 'und', 'oder', 'im', 'in', 'am', 'an', 'mit', 'fur', 'von', 'zu', 'ein', 'eine']);
export function queryWords(query: string) { return normalizeSearch(searchQuery(query)).split(' ').filter(word => word && !stopwords.has(word)); }
export function searchExcerpt(text: string, query: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const words = queryWords(query);
  const at = clean.split(/\s+/).findIndex(word => words.some(q => normalizeSearch(word).startsWith(q)));
  const offset = at < 0 ? 0 : Math.max(0, clean.split(/\s+/).slice(0, Math.max(0, at - 5)).join(' ').length);
  const excerpt = clean.slice(offset, offset + 190).trim();
  return `${offset ? '… ' : ''}${excerpt}${offset + 190 < clean.length ? ' …' : ''}`;
}
export function matchSearchDocument(document: SearchDocument, query: string): SearchHit | null {
  const words = queryWords(query);
  const title = normalizeSearch(document.title), body = normalizeSearch(document.body);
  const terms = `${title} ${body}`.split(' ');
  if (!words.length || !words.every(word => terms.some(term => term.startsWith(word)))) return null;
  const normalized = normalizeSearch(query);
  const rank = title === normalized ? 1000 : title.startsWith(normalized) ? 800
    : words.every(word => title.split(' ').some(term => term.startsWith(word))) ? 600 : 100;
  return { id: document.id, type: document.type, title: document.title, url: document.url,
    excerpt: searchExcerpt(document.body, query), rank };
}
export function mergeSearchHits(hits: SearchHit[]) {
  const unique = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = `${hit.type}:${hit.id}`;
    if (!unique.has(key) || unique.get(key)!.rank < hit.rank) unique.set(key, hit);
  }
  return [...unique.values()].sort((a, b) => b.rank - a.rank || a.title.localeCompare(b.title, 'de') || a.id.localeCompare(b.id));
}
export function searchResultPage(profiles: SearchHit[], otherHits: SearchHit[], profileTotal: number, type: SearchType | undefined, page: number) {
  const other = mergeSearchHits(otherHits);
  const combined = mergeSearchHits([...profiles, ...other]).filter(hit => !type || hit.type === type);
  const total = type === 'accommodation' ? profileTotal : type ? other.filter(hit => hit.type === type).length : profileTotal + other.length;
  return { total, hits: combined.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE) };
}
