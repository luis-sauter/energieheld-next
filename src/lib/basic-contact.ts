// Public Basic DTO: never substitute a Listing or a private acquisition row.
export type BasicContact = {
  kind: 'basic'; id: string; name: string;
  address: { city: string; region: string; country: string; street?: string | null; houseNumber?: string | null; postalCode?: string | null };
  phone: string;
};
export type DirectoryEntry = import('@/types/portal').Listing | BasicContact;
export const isBasicContact = (entry:DirectoryEntry):entry is BasicContact => 'kind' in entry && entry.kind==='basic';
export function readBasicContact(value: unknown): BasicContact {
  if (!value || typeof value !== 'object') throw Error('Invalid Basic contact');
  const row = value as Record<string, unknown>, a = row.address as Record<string, unknown>;
  if (row.kind !== 'basic' || typeof row.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(row.id) ||
    typeof row.name !== 'string' || !row.name.trim() || row.name.length > 300 || typeof row.phone !== 'string' || !/^\+[1-9]\d{6,14}$/.test(row.phone) ||
    !a || typeof a !== 'object' || ['city','region','country'].some(k => typeof a[k] !== 'string' || !a[k]) ||
    !['DE','AT','CH','IT'].includes(String(a.country)) || ['street','houseNumber','postalCode'].some(k => a[k] != null && typeof a[k] !== 'string')) throw Error('Invalid Basic contact');
  // Explicit nested allowlist, also at the application boundary.
  return { kind:'basic', id:row.id, name:row.name, phone:row.phone, address:{city:a.city as string,region:a.region as string,country:a.country as string,
    ...(a.street != null ? {street:a.street as string}:{}), ...(a.houseNumber != null ? {houseNumber:a.houseNumber as string}:{}), ...(a.postalCode != null ? {postalCode:a.postalCode as string}:{})} };
}
