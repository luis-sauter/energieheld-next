'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

export function AutoLoad({ hasMore, loading, error, load, showLoading = true }: {
  hasMore: boolean; loading: boolean; error?: string; load: () => void; showLoading?: boolean;
}) {
  const target = useRef<HTMLDivElement>(null);
  const fallback = useSyncExternalStore(()=>()=>{},()=>!("IntersectionObserver" in window),()=>false);
  useEffect(() => {
    if (!hasMore || loading || error) return;
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) load();
    }, { rootMargin: '300px 0px' });
    if (target.current) observer.observe(target.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, load]);
  return <div ref={target} className="auto-load" aria-live="polite">
    {loading ? showLoading ? <p role="status">Weitere Ergebnisse werden geladen …</p> : null : error ?
      <><p role="status">{error}</p><button type="button" className="button" onClick={load}>Erneut versuchen</button></> :
      hasMore && fallback ? <button type="button" className="button" onClick={load}>Weitere Ergebnisse laden</button> :
      !hasMore ? <span className="sr-only">Alle Ergebnisse sind geladen.</span> : null}
  </div>;
}
