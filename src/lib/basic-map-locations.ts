import 'server-only';
import { createHash } from 'node:crypto';
import { createPublicClient } from './supabase/public';
import locations from '../data/basic-map-locations.json' with { type: 'json' };
import { publicMapLocations } from './europe-map';

type PublicAddress = Record<string, unknown>;
export function basicMapFingerprint(address: PublicAddress) {
  return createHash('md5').update(['street','houseNumber','postalCode','city','region','country']
    .map(key => typeof address[key] === 'string' ? address[key] : '').join('|')).digest('hex');
}

// Coordinates are a reviewed build-time projection; the existing public contact
// visibility rules remain authoritative through the bounded anonymous RPC.
// Never read acquisition here.
export async function loadBasicMapLocations() {
  try {
    const client = createPublicClient();
    const current = new Map<string, string>();
    const ids = Array.from(new Set(locations.map(location => location.id))).sort();
    if (!ids.length || ids.length > 200000) return [];
    const bounds: (string | null)[] = [null];
    for (let index = 999; index < ids.length - 1; index += 1000) bounds.push(ids[index]);
    let next = 0, requests = 0, failed = false;
    async function worker() {
      try {
        while (!failed && next < bounds.length) {
          const index = next++;
          let after = bounds[index];
          const until = bounds[index + 1] ?? null;
          while (!failed) {
            if (++requests > 200) throw Error('Map page budget exceeded');
            const { data, error } = await client.rpc('public_basic_map_contacts', { p_after: after, p_limit: 1000 });
            if (error || !Array.isArray(data) || data.length > 1000) throw Error('Map page unavailable');
            let previous = after;
            for (const row of data) {
              if (typeof row.id !== 'string' || (previous !== null && row.id <= previous)) throw Error('Invalid map cursor');
              previous = row.id;
              const fingerprint = basicMapFingerprint(row.address ?? {});
              if (current.has(row.id) && current.get(row.id) !== fingerprint) throw Error('Map address changed during read');
              current.set(row.id, fingerprint);
            }
            if (data.length < 1000 || (until !== null && previous !== null && previous >= until)) break;
            after = previous;
          }
        }
      } catch (error) { failed = true; throw error; }
    }
    // Public IDs are range cursors only, never permission: every range still
    // uses the live anonymous visibility/address gate. Continue within a range
    // when newer public rows displace snapshot IDs from its first page.
    const results = await Promise.allSettled(Array.from({ length: Math.min(4, bounds.length) }, () => worker()));
    if (failed || results.some(result => result.status === 'rejected')) return [];
    const valid = locations.filter(location => current.get(location.id) === location.address_fingerprint);
    return publicMapLocations(valid, new Set(valid.map(location => location.id)));
  } catch { return []; }
}
