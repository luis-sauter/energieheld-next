"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { nextProfileGroup, rotationCanPlay, scheduleProfileAdvance } from "@/lib/profile-rotation";
import styles from "./profile-rotation.module.css";

// Cards remain Server Components. Only paging and the idle timer need JS.
export function ProfileRotation({ groups, count }: { groups: ReactNode[]; count: number }) {
  const [page, setPage] = useState(0);
  const [interaction, setInteraction] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [tabHidden, setTabHidden] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(preference.matches);
    const syncTab = () => setTabHidden(document.hidden);
    syncMotion(); syncTab();
    preference.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncTab);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => {
      preference.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncTab);
      observer.disconnect();
    };
  }, []);
  const canPlay = rotationCanPlay(groups.length, hovered, focused, touching, paused, reducedMotion, !visible, tabHidden);
  useEffect(() => {
    if (!canPlay) return;
    return scheduleProfileAdvance(() => setPage((value) => nextProfileGroup(value, 1, groups.length)));
  }, [canPlay, page, interaction, groups.length]);
  function move(direction: number) {
    setPage((value) => nextProfileGroup(value, direction, groups.length));
    setInteraction((value) => value + 1);
  }
  return <div ref={root} className={styles.rotation} role="region" aria-label="Passende Unterkünfte in Gruppen"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}
    onPointerDown={() => { setTouching(true); setInteraction((value) => value + 1); }}
    onPointerUp={() => setTouching(false)} onPointerCancel={() => setTouching(false)}
    onPointerLeave={() => setTouching(false)}
    onKeyDown={(event) => {
      // Do not intercept keys belonging to links or other controls.
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
      }
    }} tabIndex={groups.length > 1 ? 0 : undefined}>
    {groups.length > 1 && <div className={styles.controls}>
      <button type="button" aria-label="Vorherige sechs Unterkünfte" onClick={() => move(-1)}>←</button>
      <span aria-live={focused ? "polite" : "off"} aria-atomic="true">Gruppe {page + 1} von {groups.length} · {count} Unterkünfte</span>
      <button type="button" aria-label="Nächste sechs Unterkünfte" onClick={() => move(1)}>→</button>
      <button type="button" aria-pressed={paused} disabled={reducedMotion}
        title={reducedMotion ? "Bei reduzierter Bewegung ist der automatische Wechsel deaktiviert." : undefined}
        onClick={() => setPaused((value) => !value)}>
        {paused ? "Automatisch wechseln" : "Automatischen Wechsel pausieren"}
      </button>
    </div>}
    <div className={groups.length > 1 ? styles.pages : undefined}>
      {groups.map((group, index) => <div key={index} hidden={index !== page} inert={index !== page}
        className={styles.page} aria-label={`Unterkünfte, Gruppe ${index + 1}`}>{group}</div>)}
    </div>
  </div>;
}
