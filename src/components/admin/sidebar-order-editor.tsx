"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import { adPlacements } from "@/lib/ad-values";
import { sidebarCreative } from "@/lib/advertising-rail";
import type { ActiveAd } from "@/lib/ad-values";
import { defaultSidebarOrder, isSidebarOrder, moveSidebarSlot, type SidebarSlot } from "@/lib/sidebar-order";
import { sidebarContentAt, sidebarContentToken } from "@/lib/sidebar-content";
import { useDirectoryEditMode } from "./directory-edit-mode";
import { useInlineBanners } from "@/components/advertising/inline-banner-context";
import styles from "./sidebar-order-editor.module.css";

const label = (slot: SidebarSlot) => adPlacements[slot];

export function SidebarOrderSlots({
  ads,
  slots,
  editing,
  busy,
  dragged,
  target,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onMove,
  canMove = () => true,
}: {
  ads: ActiveAd[];
  slots: SidebarSlot[];
  editing: boolean;
  busy: boolean;
  dragged: SidebarSlot | null;
  target: SidebarSlot | null;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, slot: SidebarSlot) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onMove: (from: number, to: number) => void;
  canMove?: (from: number, to: number) => boolean;
}) {
  const inline = useInlineBanners();
  const sources = isSidebarOrder(slots) ? slots : [...defaultSidebarOrder];
  const contents = defaultSidebarOrder.flatMap((slot) => {
    const ad = sidebarCreative(slot, ads);
    return ad ? [ad] : [];
  });
  return defaultSidebarOrder.map((slot, index) => {
    const ad = sidebarContentAt(contents, sources, index);
    if (!editing && !ad && !inline) return null;
    return (
    <div key={slot} data-sidebar-slot={slot}
      className={`${styles.row} ${dragged === slot ? styles.dragging : ""} ${target === slot ? styles.target : ""}`}>
      {editing && (
        <>
          <strong className={styles.label}>{label(slot)}</strong>
          <div className={styles.controls}>
            <button type="button" className={styles.handle} aria-label={`${label(slot)} verschieben`}
              onPointerDown={(event) => onPointerDown(event, slot)} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerCancel={onPointerUp} disabled={busy || !canMove(index, index)}>↕</button>
            <button type="button" aria-label={`${label(slot)} nach oben`} disabled={busy || index === 0 || !canMove(index, index - 1)}
              onClick={() => onMove(index, index - 1)}>↑</button>
            <button type="button" aria-label={`${label(slot)} nach unten`} disabled={busy || index === defaultSidebarOrder.length - 1 || !canMove(index, index + 1)}
              onClick={() => onMove(index, index + 1)}>↓</button>
          </div>
        </>
      )}
      {ad || inline ? (
        <CampaignSlot placement={slot} ad={ad} showLabel={false} reordering={editing} />
      ) : <div className={styles.placeholder}>Noch kein Banner</div>}
    </div>
  );
  });
}

export function SidebarOrderEditor({
  ads,
  saveOrder,
}: {
  ads: ActiveAd[];
  slots: SidebarSlot[];
  saveOrder: (sources: SidebarSlot[], expected?: string[]) => Promise<{ success?: string; error?: string }>;
}) {
  const router = useRouter();
  const { mode, setMode } = useDirectoryEditMode();
  const inline = useInlineBanners();
  const currentAds = defaultSidebarOrder.flatMap((slot) => {
    const ad = inline && Object.hasOwn(inline.overrides, slot) ? inline.overrides[slot] : sidebarCreative(slot, ads);
    return ad ? [ad] : [{ id: `hidden:${slot}`, placement: slot, suppressed: true, source: "hidden" as const,
      headline: "", body_text: null, target_url: "", image_path: null }];
  });
  const initialKey = JSON.stringify(ads);
  const [saved, setSaved] = useState({ key: initialKey, sources: [...defaultSidebarOrder] as SidebarSlot[] });
  const savedSources = saved.key === initialKey ? saved.sources : [...defaultSidebarOrder];
  const [draft, setDraft] = useState<SidebarSlot[]>([...defaultSidebarOrder]);
  const expectedRef = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dragged, setDragged] = useState<SidebarSlot | null>(null);
  const [target, setTarget] = useState<SidebarSlot | null>(null);
  const busyRef = useRef(false);
  const dragRef = useRef<SidebarSlot | null>(null);
  const lastTargetRef = useRef<SidebarSlot | null>(null);
  const dragBoundsRef = useRef<{ slot: SidebarSlot; top: number; bottom: number }[]>([]);
  const editing = mode === "sidebar";
  const awaitingRefresh = saved.key === initialKey && saved.sources.some((source, index) => source !== defaultSidebarOrder[index]);

  function start() {
    if (mode) return;
    setDraft([...defaultSidebarOrder]);
    expectedRef.current = defaultSidebarOrder.map((slot) => sidebarContentToken(slot,
      currentAds.find((ad) => ad.placement === slot), inline?.bannerAt?.(slot)));
    setError("");
    setMessage("");
    setMode("sidebar");
  }

  function cancel() {
    setDraft(savedSources);
    setError("");
    dragRef.current = null;
    lastTargetRef.current = null;
    setDragged(null);
    setTarget(null);
    setMode(null);
  }

  async function save() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await saveOrder(draft, expectedRef.current);
      if (!result.success) {
        setError(result.error ?? "Die Banner-Reihenfolge konnte nicht gespeichert werden.");
        return;
      }
      setSaved({ key: initialKey, sources: draft });
      inline?.reordered?.();
      setMessage(result.success);
      setMode(null);
      router.refresh();
    } catch {
      setError("Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, slot: SidebarSlot) {
    if (busy || !canMove(defaultSidebarOrder.indexOf(slot), defaultSidebarOrder.indexOf(slot))) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = slot;
    // Different image heights must not move the hit target back under the pointer.
    dragBoundsRef.current = [...document.querySelectorAll<HTMLElement>("[data-sidebar-slot]")].map((row) => {
      const bounds = row.getBoundingClientRect();
      return { slot: row.dataset.sidebarSlot as SidebarSlot, top: bounds.top + window.scrollY, bottom: bounds.bottom + window.scrollY };
    });
    lastTargetRef.current = null;
    setDragged(slot);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const slot = dragRef.current;
    if (!slot) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sidebar-slot]");
    if (!hit) return;
    const pointerY = event.clientY + window.scrollY;
    const over = dragBoundsRef.current.find((bounds) => pointerY >= bounds.top && pointerY <= bounds.bottom)?.slot;
    if (!over || over === slot || !defaultSidebarOrder.includes(over)) return;
    const from = defaultSidebarOrder.indexOf(slot), to = defaultSidebarOrder.indexOf(over);
    if (!canMove(from, to)) return;
    if (lastTargetRef.current === over) return;
    lastTargetRef.current = over;
    setTarget(over);
    setDraft((current) => moveSidebarSlot(current, from, to));
    dragRef.current = over;
    setDragged(over);
  }

  function onPointerUp() {
    dragRef.current = null;
    dragBoundsRef.current = [];
    lastTargetRef.current = null;
    setDragged(null);
    setTarget(null);
  }

  function canMove(from: number, to: number) {
    return from >= 0 && to >= 0 && to < defaultSidebarOrder.length &&
      draft.slice(Math.min(from, to), Math.max(from, to) + 1).every((source) => inline?.canMove?.(source) ?? true);
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        {editing ? (
          <>
            <strong>Banner-Bearbeitung aktiv</strong>
            <button className="button button-primary" type="button" onClick={save} disabled={busy}>
              {busy ? "Speichert …" : "Banner-Reihenfolge speichern"}
            </button>
            <button className="button" type="button" onClick={cancel} disabled={busy}>Abbrechen</button>
          </>
        ) : (
          <button className="button" type="button" onClick={start} disabled={mode === "companies" || awaitingRefresh}>
            Banner-Reihenfolge bearbeiten
          </button>
        )}
      </div>
      {message && !editing && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <SidebarOrderSlots ads={currentAds} slots={editing ? draft : savedSources} editing={editing} busy={busy}
        dragged={dragged} target={target} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        canMove={canMove} onMove={(from, to) => { if (canMove(from, to)) setDraft((current) => moveSidebarSlot(current, from, to)); }} />
    </div>
  );
}
