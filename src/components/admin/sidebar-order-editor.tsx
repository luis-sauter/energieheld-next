"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { CampaignSlot } from "@/components/advertising/campaign-view";
import type { ActiveAd } from "@/lib/ad-values";
import { moveSidebarSlot, type SidebarSlot } from "@/lib/sidebar-order";
import { useDirectoryEditMode } from "./directory-edit-mode";
import styles from "./sidebar-order-editor.module.css";

const label = (slot: SidebarSlot) => ({
  sidebar_top: "Banner A",
  sidebar_middle: "Banner B",
  sidebar_bottom: "Banner C",
})[slot];

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
}) {
  return slots.map((slot, index) => (
    <div key={slot} data-sidebar-slot={slot}
      className={`${styles.row} ${dragged === slot ? styles.dragging : ""} ${target === slot ? styles.target : ""}`}>
      {editing && (
        <>
          <strong className={styles.label}>{label(slot)}</strong>
          <div className={styles.controls}>
            <button type="button" className={styles.handle} aria-label={`${label(slot)} verschieben`}
              onPointerDown={(event) => onPointerDown(event, slot)} onPointerMove={onPointerMove}
              onPointerUp={onPointerUp} onPointerCancel={onPointerUp} disabled={busy}>↕</button>
            <button type="button" aria-label={`${label(slot)} nach oben`} disabled={busy || index === 0}
              onClick={() => onMove(index, index - 1)}>↑</button>
            <button type="button" aria-label={`${label(slot)} nach unten`} disabled={busy || index === 2}
              onClick={() => onMove(index, index + 1)}>↓</button>
          </div>
        </>
      )}
      <CampaignSlot placement={slot} ad={ads.find((ad) => ad.placement === slot)} />
    </div>
  ));
}

export function SidebarOrderEditor({
  ads,
  slots,
  saveOrder,
}: {
  ads: ActiveAd[];
  slots: SidebarSlot[];
  saveOrder: (slots: SidebarSlot[]) => Promise<{ success?: string; error?: string }>;
}) {
  const router = useRouter();
  const { mode, setMode } = useDirectoryEditMode();
  const initialKey = slots.join("|");
  const [saved, setSaved] = useState({ key: initialKey, slots });
  const savedSlots = saved.key === initialKey ? saved.slots : slots;
  const [draft, setDraft] = useState<SidebarSlot[]>(slots);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dragged, setDragged] = useState<SidebarSlot | null>(null);
  const [target, setTarget] = useState<SidebarSlot | null>(null);
  const busyRef = useRef(false);
  const dragRef = useRef<SidebarSlot | null>(null);
  const editing = mode === "sidebar";

  function start() {
    if (mode) return;
    setDraft(savedSlots);
    setError("");
    setMessage("");
    setMode("sidebar");
  }

  function cancel() {
    setDraft(savedSlots);
    setError("");
    dragRef.current = null;
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
      const result = await saveOrder(draft);
      if (!result.success) {
        setError(result.error ?? "Die Banner-Reihenfolge konnte nicht gespeichert werden.");
        return;
      }
      setSaved({ key: initialKey, slots: draft });
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
    if (busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = slot;
    setDragged(slot);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const slot = dragRef.current;
    if (!slot) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sidebar-slot]");
    const over = hit?.dataset.sidebarSlot as SidebarSlot | undefined;
    if (!over || over === slot || !slots.includes(over)) return;
    setTarget(over);
    setDraft((current) => moveSidebarSlot(current, current.indexOf(slot), current.indexOf(over)));
  }

  function onPointerUp() {
    dragRef.current = null;
    setDragged(null);
    setTarget(null);
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
          <button className="button" type="button" onClick={start} disabled={mode === "companies"}>
            Banner-Reihenfolge bearbeiten
          </button>
        )}
      </div>
      {message && !editing && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <SidebarOrderSlots ads={ads} slots={editing ? draft : savedSlots} editing={editing} busy={busy}
        dragged={dragged} target={target} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onMove={(from, to) => setDraft((current) => moveSidebarSlot(current, from, to))} />
    </div>
  );
}
