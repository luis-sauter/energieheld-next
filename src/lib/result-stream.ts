export type ResultBatch<T, C> = { items: T[]; nextCursor: C | null; total: number };

// One observable request state per result stream. The hook owns its lifetime;
// disposed streams cannot publish responses into another query.
export function createResultStream<T, C>({ initial, firstCursor, url, itemKey, request = fetch }: {
  initial?: ResultBatch<T, C>; firstCursor: C;
  url: (cursor: C) => string; itemKey: (item: T) => string; request?: typeof fetch;
}) {
  const first = { ...(initial ?? { items: [], nextCursor: firstCursor, total: 0 }), loading: !initial, error: '' };
  let state = first, busy = false, active = true, generation = 0;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: typeof state) => { state = next; listeners.forEach(listener => listener()); };

  async function load() {
    if (busy || !active || state.nextCursor === null) return;
    busy = true;
    const version = generation, cursor = state.nextCursor, own = new AbortController();
    controller = own; emit({ ...state, loading: true, error: '' });
    try {
      const response = await request(url(cursor), { signal: own.signal, cache: 'no-store' });
      if (!response.ok) throw Error('Unavailable');
      const page = await response.json() as ResultBatch<T, C>;
      if (!Object.hasOwn(page, 'nextCursor') || !Array.isArray(page.items) || page.items.length > 20 ||
          !Number.isSafeInteger(page.total) || page.total < 0 ||
          page.nextCursor !== null && (!page.items.length || JSON.stringify(page.nextCursor) === JSON.stringify(cursor)))
        throw Error('Invalid page');
      if (!active || own.signal.aborted || generation !== version) return;
      const seen = new Set(state.items.map(itemKey));
      emit({ ...page, items: [...state.items, ...page.items.filter(item => {
        const key = itemKey(item);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      })], loading: false, error: '' });
    } catch {
      if (active && !own.signal.aborted && generation === version)
        emit({ ...state, loading: false, error: 'Weitere Ergebnisse konnten nicht geladen werden.' });
    } finally { if (controller === own) busy = false; }
  }
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => state, serverSnapshot: () => first, load,
    start: () => { active = true; if (!initial) void load(); },
    dispose: () => { active = false; generation++; controller?.abort(); busy = false; state = {...state,loading:false}; },
  };
}
