"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRotationMotion } from "./use-rotation-motion";
import styles from "./theme-scroller.module.css";

export const themeScrollerDelay = 3000;
export const compactScrollSpeed = 30; // Pixels/second, independent of display refresh rate.
export function continuousThemeScroll(left: number, seconds: number, max: number, direction: number) {
  const next = Math.max(0, Math.min(max, left + direction * compactScrollSpeed * seconds));
  return { left: next, direction: next >= max ? -1 : next <= 0 ? 1 : direction };
}
export function nextThemeScroll(left: number, step: number, max: number, direction: number) {
  if (max <= 0) return 0;
  if (direction > 0) return left >= max - 1 ? 0 : Math.min(max, left + step);
  return left <= 1 ? max : Math.max(0, left - step);
}

// Cards/links are server-rendered children; navigation never fetches more data.
export function ThemeScroller({ children, count, label, compact = false, heading, moreLink, edgeNavigation = false, pageSize, autoPlay = true }: {
  children: ReactNode; count: number; label: string; compact?: boolean; heading?: ReactNode; moreLink?: ReactNode; edgeNavigation?: boolean; pageSize?: number; autoPlay?: boolean;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const manualUntil = useRef(0);
  const autoLeft = useRef<number | null>(null);
  const direction = useRef(1);
  const pageItems = pageSize ? Children.toArray(children) : [];
  const move = useCallback((direction: number, smooth: boolean) => {
    const element = rail.current;
    if (!element) return;
    const page = element.children[0] as HTMLElement | undefined;
    const first = (pageSize && page && getComputedStyle(page).display === 'contents' ? page.firstElementChild : page) as HTMLElement | undefined;
    const second = first?.nextElementSibling as HTMLElement | undefined;
    const step = compact ? element.clientWidth * 0.8
      : first && second ? second.offsetLeft - first.offsetLeft : element.clientWidth;
    manualUntil.current = performance.now() + 1500;
    autoLeft.current = null;
    element.scrollTo({ left: nextThemeScroll(element.scrollLeft, step,
      element.scrollWidth - element.clientWidth, direction), behavior: smooth ? "smooth" : "instant" });
    setInteraction(value => value + 1);
  }, [compact, pageSize]);
  const advance = useCallback(() => move(1, true), [move]);
  const { root, handlers, reducedMotion, interact, canPlay } = useRotationMotion(overflowing ? count : 1, advance, interaction, themeScrollerDelay, !compact && autoPlay);
  useEffect(() => {
    if (!compact || !canPlay || !autoPlay) return;
    let frame = 0, previous: number | undefined, position = rail.current?.scrollLeft ?? 0;
    const tick = (now: number) => {
      const element = rail.current;
      if (element && previous !== undefined && now >= manualUntil.current) {
        const next = continuousThemeScroll(position, Math.min(now - previous, 64) / 1000,
          element.scrollWidth - element.clientWidth, direction.current);
        direction.current = next.direction;
        position = next.left;
        element.scrollLeft = next.left;
        autoLeft.current = element.scrollLeft;
      } else if (element) position = element.scrollLeft;
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [compact, canPlay, autoPlay]);
  // Native scroll + CSS snap support touch, trackpads and focused links.
  const attachRail = useCallback((element: HTMLDivElement | null) => {
    rail.current = element;
    if (!element) return;
    const observer = new ResizeObserver(() => setOverflowing(element.scrollWidth > element.clientWidth + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const cards = <div ref={attachRail} className={styles.rail} tabIndex={0} aria-label={`${label}: Karten`}
    onWheel={() => { manualUntil.current = performance.now() + 1000; }}
    onScroll={() => {
      if (!compact) { interact(); return; }
      if (rail.current && (autoLeft.current === null || Math.abs(rail.current.scrollLeft - autoLeft.current) > 1)) {
        manualUntil.current = performance.now() + 1000;
      }
    }} onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1, !reducedMotion);
      }
    }}>{pageSize ? Array.from({ length: Math.ceil(pageItems.length / pageSize) }, (_, index) =>
      <div key={index} className={styles.page} data-carousel-page>{pageItems.slice(index * pageSize, (index + 1) * pageSize)}</div>) : children}</div>;
  return <div ref={root} className={styles.scroller} data-compact={compact || undefined}
    data-edge-navigation={edgeNavigation || undefined}
    data-page-size={pageSize}
    role="region" aria-label={label} {...handlers}>
    {!compact && (heading || moreLink || !edgeNavigation) && <div className={styles.header}>
      {heading}
      <div className={styles.controls}>
        {moreLink}
        {count > 1 && !edgeNavigation && <>
          <button type="button" disabled={!overflowing} aria-label={`${label}: zurück`} onClick={() => move(-1, !reducedMotion)}>←</button>
          <button type="button" disabled={!overflowing} aria-label={`${label}: weiter`} onClick={() => move(1, !reducedMotion)}>→</button>
        </>}
      </div>
    </div>}
    {compact && overflowing && <div className={styles.edgeControls}>
      <button type="button" aria-label="Quicklinks zurück" onClick={() => move(-1, !reducedMotion)}>←</button>
      <button type="button" aria-label="Quicklinks weiter" onClick={() => move(1, !reducedMotion)}>→</button>
    </div>}
    {edgeNavigation ? <div className={styles.imageRail}>
      {cards}
      {count > 1 && <div className={styles.edgeControls}>
        <button type="button" disabled={!overflowing} aria-label={`${label}: zurück`} onClick={() => move(-1, !reducedMotion)}>←</button>
        <button type="button" disabled={!overflowing} aria-label={`${label}: weiter`} onClick={() => move(1, !reducedMotion)}>→</button>
      </div>}
    </div> : cards}
  </div>;
}
