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
    let after = '';
    for (let page = 0; page < 200; page++) {
      const { data, error } = await client.rpc('public_basic_map_contacts', { p_after: after || null, p_limit: 1000 });
      if (error || !Array.isArray(data) || data.length > 1000) return [];
      for (const row of data) current.set(row.id, basicMapFingerprint(row.address ?? {}));
      if (data.length < 1000) break;
      after = data[data.length - 1].id;
      if (page === 199) return [];
    }
    const valid = locations.filter(location => current.get(location.id) === location.address_fingerprint);
    return publicMapLocations(valid, new Set(valid.map(location => location.id)));
  } catch { return []; }
}
