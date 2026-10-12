"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useRotationMotion } from './use-rotation-motion';
import styles from './motto-detail.module.css';

// Recycle unique keyed cards, without cloning links or fetching server data.
export function MottoRow({ children, label, speed = 18 }: { children: ReactNode; label: string; speed?: number }) {
  const items = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const idleUntil = useRef(0);
  const { root, handlers, canPlay, interact } = useRotationMotion(items.length, () => {}, label, 4000, false);
  const ordered = [...items.slice(offset), ...items.slice(0, offset)];
  const stride = () => {
    const element = track.current;
    return element && element.children.length > 1
      ? (element.children[1] as HTMLElement).offsetLeft - (element.children[0] as HTMLElement).offsetLeft : 0;
  };
  const rotate = (steps: number) => flushSync(() => setOffset(value => (value + steps + items.length) % items.length));
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 2);
    const observer = new ResizeObserver(update);
    observer.observe(element); update();
    return () => observer.disconnect();
  }, [items.length]);
  useEffect(() => {
    const element = track.current;
    if (!element || !canPlay || !overflowing) return;
    let frame = 0, last = 0, position = element.scrollLeft;
    const tick = (now: number) => {
      const step = stride();
      if (last && now >= idleUntil.current && step > 0) {
        position += Math.min(now - last, 50) * speed / 1000;
        if (position >= step) {
          flushSync(() => setOffset(value => (value + 1) % items.length));
          position -= step; element.scrollLeft = position;
        } else element.scrollLeft = position;
      }
      last = now; frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [canPlay, overflowing, speed, items.length]);
  function move(direction: number) {
    const element = track.current, step = stride();
    if (!element || !overflowing || !step) return;
    idleUntil.current = performance.now() + 5000; interact();
    rotate(direction); element.scrollLeft = 0;
  }
  return <div ref={root} {...handlers} className={styles.row} role="region" aria-label={label} data-speed={speed}>
    <div ref={track} className={styles.track} tabIndex={0} onScroll={event => {
      if (!canPlay) idleUntil.current = performance.now() + 5000;
      const element = event.currentTarget, step = stride();
      if (!canPlay && step > 0 && element.scrollLeft >= step) {
        const position = element.scrollLeft;
        rotate(1); element.scrollLeft = position - step;
      }
    }} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);
      }
    }}>{ordered}</div>
    {overflowing && <>
      <button className={`${styles.arrow} ${styles.previous}`} type="button" aria-label={`Vorherige ${label}`} onClick={() => move(-1)}>‹</button>
      <button className={`${styles.arrow} ${styles.next}`} type="button" aria-label={`Weitere ${label}`} onClick={() => move(1)}>›</button>
    </>}
  </div>;
}
