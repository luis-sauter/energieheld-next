export type CompanySearchResult = { items: { id: string; display_name: string }[]; more: boolean; error?: string };
// Bounded per-dialog cache, including in-flight requests. Never shared across users.
export function companySearchCache(search: (query: string, page: number) => Promise<CompanySearchResult>) {
  const entries = new Map<string, { time: number; result: Promise<CompanySearchResult> }>();
  const key = (query: string, page: number) => JSON.stringify([query.trim().toLocaleLowerCase('de'), page]);
  function has(query: string, page: number) { const entry = entries.get(key(query, page)); return Boolean(entry && Date.now() - entry.time < 300000); }
  function get(query: string, page: number) {
    const id = key(query, page);
    if (has(query, page)) return entries.get(id)!.result;
    if (entries.size >= 32) entries.delete(entries.keys().next().value!);
    const result = search(query, page).then(value => { if (value.error) entries.delete(id); return value; }).catch(error => { entries.delete(id); throw error; });
    entries.set(id, { time: Date.now(), result });
    return result;
  }
  return { has, get, clear: () => entries.clear() };
}

export type CompanySearchCache = ReturnType<typeof companySearchCache>;

// The same bounded picker/cache can search already-authorized advertiser options.
export function normalizedCompanyName(value: string) {
  return value.trim().toLocaleLowerCase('de').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
}
export function localCompanySearchCache(items: { id: string; display_name: string }[]) {
  return companySearchCache(async (query, page) => {
    const matches = items.filter(item => normalizedCompanyName(item.display_name).includes(normalizedCompanyName(query)));
    const start = (page - 1) * 20;
    return { items: matches.slice(start, start + 20), more: matches.length > start + 20 };
  });
}
