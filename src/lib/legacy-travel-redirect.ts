// Only spellings and filters observed in the public Joomla navigation.
const aliases: Record<string, string> = {
  '/reiseziele/österreich': '/reiseziele/oesterreich',
  '/reiseziele/südtirol-italien': '/reiseziele/suedtirol-italien',
  '/mottoreisen/geschäftsreisen': '/mottoreisen/geschaeftsreisen',
  '/unterkünfte-a-z': '/unterkuenfte-a-z',
};
const themes: Record<string, string> = {
  'Natur pur': 'natur-pur', 'Nordic Walking': 'nordic-walking', Radwandern: 'radwandern',
  Wanderurlaub: 'wanderurlaub', Familienurlaub: 'familienurlaub', Golfurlaub: 'golfurlaub',
  'Urlaub am Wasser': 'urlaub-am-wasser', Campingurlaub: 'campingurlaub',
  'Romantik zu zweit': 'romantik-zu-zweit', Wellnessangebote: 'wellnessangebote', Geschäftsreisen: 'geschaeftsreisen',
};

export function legacyTravelRedirect(pathname: string, search: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const path = aliases[decoded] ?? decoded;
  // Never rewrite arbitrary destinations, admin/auth requests or external URLs.
  if (!['/', '/reiseziele', '/mottoreisen', '/unterkuenfte-a-z'].includes(path) &&
      !/^\/(reiseziele|mottoreisen)\/[a-z-]+$/.test(path)) return null;
  const query = new URLSearchParams(search);
  let changed = Boolean(aliases[decoded]);
  if (query.get('types[0]') === '1') { query.delete('types[0]'); changed = true; }
  const oldTheme = query.get('filter[bd_category][0]');
  if (path === '/unterkuenfte-a-z' && oldTheme && themes[oldTheme] && !query.has('thema')) {
    query.delete('filter[bd_category][0]'); query.set('thema', themes[oldTheme]); changed = true;
  }
  return changed ? path + (query.size ? `?${query.toString()}` : '') : null;
}

export function legacyProfileRewrite(pathname: string): string | null {
  let path: string;
  try { path = decodeURIComponent(pathname); } catch { return null; }
  const match = /^\/unterkünfte-a-z\/liste\/([^/]+)$/.exec(path);
  return match ? `/unterkuenfte-a-z/liste/${encodeURIComponent(match[1])}` : null;
}
