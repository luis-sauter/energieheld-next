"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './motto-detail.module.css';

// Native scrolling keeps all server-rendered links reachable and lazy-loads
// offscreen images. No timer, network request, clone, or client-side shuffle.
export function MottoRow({ children, label }: { children: ReactNode; label: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const update = () => setEdges({ previous: element.scrollLeft > 2,
      next: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
    const observer = new ResizeObserver(update);
    observer.observe(element); element.addEventListener('scroll', update, { passive: true }); update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, []);
  function move(direction: number) {
    const element = root.current;
    if (element) element.scrollBy({ left: direction * (element.clientWidth + 18),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <div className={styles.row} role="region" aria-label={label}>
    <div ref={root} className={styles.track} tabIndex={0} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);
      }
    }}>{children}</div>
    {edges.previous && <button className={`${styles.arrow} ${styles.previous}`} type="button" aria-label={`Vorherige ${label}`} onClick={() => move(-1)}>‹</button>}
    {edges.next && <button className={`${styles.arrow} ${styles.next}`} type="button" aria-label={`Weitere ${label}`} onClick={() => move(1)}>›</button>}
  </div>;
}
