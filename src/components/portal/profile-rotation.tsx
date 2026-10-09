"use client";

import { useCallback, useState, type ReactNode } from "react";
import { nextProfileGroup } from "@/lib/profile-rotation";
import { useRotationMotion } from "./use-rotation-motion";
import styles from "./profile-rotation.module.css";

// Cards remain Server Components. Only paging and the idle timer need JS.
export function ProfileRotation({ groups, count }: { groups: ReactNode[]; count: number }) {
  const [page, setPage] = useState(0);
  const [interaction, setInteraction] = useState(0);
  const advance = useCallback(() => setPage(value => nextProfileGroup(value, 1, groups.length)), [groups.length]);
  const { root, handlers, focused, paused, reducedMotion, toggle } = useRotationMotion(groups.length, advance, `${page}:${interaction}`);
  function move(direction: number) {
    setPage((value) => nextProfileGroup(value, direction, groups.length));
    setInteraction((value) => value + 1);
  }
  return <div ref={root} className={styles.rotation} role="region" aria-label="Unterkünfte entdecken"
    {...handlers}
    onKeyDown={(event) => {
      // Do not intercept keys belonging to links or other controls.
      if (event.target !== event.currentTarget) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
      }
    }} tabIndex={groups.length > 1 ? 0 : undefined}>
    {groups.length > 1 && <div className={styles.controls}>
      <button type="button" aria-label="Vorherige sechs Unterkünfte" onClick={() => move(-1)}>←</button>
      <span aria-live={focused ? "polite" : "off"} aria-atomic="true">Unterkünfte entdecken · {count} passende Unterkünfte</span>
      <button type="button" aria-label="Nächste sechs Unterkünfte" onClick={() => move(1)}>→</button>
      <button type="button" aria-pressed={paused} disabled={reducedMotion}
        title={reducedMotion ? "Bei reduzierter Bewegung ist der automatische Wechsel deaktiviert." : undefined}
        onClick={toggle}>
        {paused ? "Automatisch wechseln" : "Automatischen Wechsel pausieren"}
      </button>
    </div>}
    <div className={groups.length > 1 ? styles.pages : undefined}>
      {groups.map((group, index) => <div key={index} hidden={index !== page} inert={index !== page}
        className={styles.page} aria-label={`Unterkünfte ${index * 6 + 1} bis ${Math.min((index + 1) * 6, count)}`}>{group}</div>)}
    </div>
  </div>;
}
