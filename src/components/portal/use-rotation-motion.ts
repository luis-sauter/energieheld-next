"use client";

import { useEffect, useRef, useState } from "react";
import { rotationCanPlay, scheduleProfileAdvance, profileRotationDelay } from "@/lib/profile-rotation";

// Shared idle/pause lifecycle for profile paging and both homepage scrollers.
export function useRotationMotion(count: number, advance: () => void, resetKey: number | string, delay = profileRotationDelay) {
  const root = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [tabHidden, setTabHidden] = useState(true);
  const [interaction, setInteraction] = useState(0);
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
  const canPlay = rotationCanPlay(count, hovered, focused, touching, paused, reducedMotion, !visible, tabHidden);
  useEffect(() => {
    if (!canPlay) return;
    return scheduleProfileAdvance(advance, delay);
  }, [canPlay, resetKey, interaction, advance, delay]);
  return { root, focused, paused, reducedMotion, toggle: () => setPaused(value => !value),
    interact: () => setInteraction(value => value + 1),
    handlers: {
      onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false),
      onFocusCapture: () => setFocused(true),
      onBlurCapture: (event: React.FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      },
      onPointerDown: () => { setTouching(true); setInteraction(value => value + 1); },
      onPointerUp: () => setTouching(false), onPointerCancel: () => setTouching(false),
      onPointerLeave: () => setTouching(false),
    },
  };
}
