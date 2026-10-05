"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { useRotationMotion } from "./use-rotation-motion";
import styles from "./theme-scroller.module.css";

export const themeScrollerDelay = 3000;
export function nextThemeScroll(left: number, step: number, max: number, direction: number) {
  if (max <= 0) return 0;
  if (direction > 0) return left >= max - 1 ? 0 : Math.min(max, left + step);
  return left <= 1 ? max : Math.max(0, left - step);
}

// Cards/links are server-rendered children; navigation never fetches more data.
export function ThemeScroller({ children, count, label, compact = false, heading, moreLink }: {
  children: ReactNode; count: number; label: string; compact?: boolean; heading?: ReactNode; moreLink?: ReactNode;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const move = useCallback((direction: number, smooth: boolean) => {
    const element = rail.current;
    if (!element) return;
    const first = element.children[0] as HTMLElement | undefined;
    const second = element.children[1] as HTMLElement | undefined;
    const step = first && second ? second.offsetLeft - first.offsetLeft : element.clientWidth;
    element.scrollTo({ left: nextThemeScroll(element.scrollLeft, step,
      element.scrollWidth - element.clientWidth, direction), behavior: smooth ? "smooth" : "instant" });
    setInteraction(value => value + 1);
  }, []);
  const advance = useCallback(() => move(1, true), [move]);
  const { root, handlers, reducedMotion, interact } = useRotationMotion(overflowing ? count : 1, advance, interaction, themeScrollerDelay);
  // Native scroll + CSS snap support touch, trackpads and focused links.
  const attachRail = useCallback((element: HTMLDivElement | null) => {
    rail.current = element;
    if (!element) return;
    const observer = new ResizeObserver(() => setOverflowing(element.scrollWidth > element.clientWidth + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={root} className={styles.scroller} data-compact={compact || undefined}
    role="region" aria-label={label} {...handlers}>
    {!compact && <div className={styles.header}>
      {heading}
      <div className={styles.controls}>
        {moreLink}
        {count > 1 && <>
          <button type="button" disabled={!overflowing} aria-label={`${label}: zurück`} onClick={() => move(-1, !reducedMotion)}>←</button>
          <button type="button" disabled={!overflowing} aria-label={`${label}: weiter`} onClick={() => move(1, !reducedMotion)}>→</button>
        </>}
      </div>
    </div>}
    <div ref={attachRail} className={styles.rail} tabIndex={0} aria-label={`${label}: Karten`}
      onScroll={interact} onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1, !reducedMotion);
        }
      }}>{children}</div>
  </div>;
}
