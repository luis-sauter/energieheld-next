"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { energieheld } from "@/config/energieheld";
import { directoryItemKey, moveDirectoryId } from "@/lib/company-directory-order";
import type { Category, Listing } from "@/types/portal";
import { ListingRow } from "@/components/portal/listing-row";
import { useDirectoryEditMode } from "./directory-edit-mode";
import styles from "./directory-order-editor.module.css";

export function DirectoryOrderRows({
  listings,
  categories = energieheld.categories,
  basePath = "/experten",
  showVerification = true,
  editing,
  busy,
  dragged,
  target,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onMove,
}: {
  listings: Listing[];
  categories?: Category[];
  basePath?: string;
  showVerification?: boolean;
  editing: boolean;
  busy: boolean;
  dragged: string | null;
  target: string | null;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, key: string) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div className="listing-rows">
      {listings.map((listing, index) => (
        editing ? (
          <div key={directoryItemKey(listing)} data-directory-id={directoryItemKey(listing)}
            className={`${styles.editRow} ${dragged === directoryItemKey(listing) ? styles.dragging : ""} ${target === directoryItemKey(listing) ? styles.dropTarget : ""}`}>
            <div className={styles.controls}>
              <button className={styles.handle} type="button" aria-label={`Firma ${listing.name} verschieben`}
                title="Ziehen, um die Firma zu verschieben"
                onPointerDown={(event) => onPointerDown(event, directoryItemKey(listing))}
                onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                disabled={busy}>↕</button>
              <button type="button" aria-label={`Firma ${listing.name} nach oben`} disabled={busy || index === 0}
                onClick={() => onMove(index, index - 1)}>↑</button>
              <button type="button" aria-label={`Firma ${listing.name} nach unten`} disabled={busy || index === listings.length - 1}
                onClick={() => onMove(index, index + 1)}>↓</button>
            </div>
            <ListingRow listing={listing} categories={categories} href={`${basePath}/${listing.slug}`} showVerification={showVerification} />
          </div>
        ) : (
          <ListingRow key={directoryItemKey(listing)} listing={listing} categories={categories} href={`${basePath}/${listing.slug}`} showVerification={showVerification} />
        )
      ))}
    </div>
  );
}

export function DirectoryOrderEditor({
  listings,
  hiddenDemoKeys = [],
  saveOrder,
  categories = energieheld.categories,
  basePath = "/experten",
  showVerification = true,
}: {
  listings: Listing[];
  hiddenDemoKeys?: string[];
  saveOrder: (ids: string[]) => Promise<{ success?: string; error?: string }>;
  categories?: Category[];
  basePath?: string;
  showVerification?: boolean;
}) {
  const router = useRouter();
  const { mode, setMode } = useDirectoryEditMode();
  const initialIds = listings.map(directoryItemKey);
  const initialKey = initialIds.join("|");
  const [saved, setSaved] = useState({ key: initialKey, ids: initialIds });
  const savedIds = saved.key === initialKey ? saved.ids : initialIds;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialIds);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const busyRef = useRef(false);
  const dragRef = useRef<string | null>(null);

  const byId = new Map(listings.map((listing) => [directoryItemKey(listing), listing]));
  const shown = (editing ? draft : savedIds)
    .map((id) => byId.get(id))
    .filter((listing): listing is Listing => Boolean(listing));

  function start() {
    if (mode) return;
    setDraft(savedIds);
    setMessage("");
    setError("");
    setEditing(true);
    setMode("companies");
  }

  function cancel() {
    setDraft(savedIds);
    setError("");
    setDragged(null);
    setTarget(null);
    dragRef.current = null;
    setEditing(false);
    setMode(null);
  }

  async function save() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await saveOrder([...draft, ...hiddenDemoKeys]);
      if (!result.success) {
        setError(result.error ?? "Die Reihenfolge konnte nicht gespeichert werden.");
        return;
      }
      setSaved({ key: initialKey, ids: draft });
      setMessage(result.success);
      setEditing(false);
      setMode(null);
      router.refresh();
    } catch {
      setError("Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = id;
    setDragged(id);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const id = dragRef.current;
    if (!id) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(
      "[data-directory-id]",
    );
    const over = hit?.dataset.directoryId;
    if (!over || over === id || !byId.has(over)) return;
    setTarget(over);
    setDraft((ids) => moveDirectoryId(ids, ids.indexOf(id), ids.indexOf(over)));
  }

  function onPointerUp() {
    dragRef.current = null;
    setDragged(null);
    setTarget(null);
  }

  return (
    <div>
      {listings.length > 0 && (
        <div className={styles.toolbar}>
          {editing ? (
            <>
              <span className={styles.mode}>Bearbeitungsmodus aktiv</span>
              <button className="button button-primary" type="button" onClick={save} disabled={busy}>
                {busy ? "Speichert …" : "Reihenfolge speichern"}
              </button>
              <button className="button" type="button" onClick={cancel} disabled={busy}>
                Abbrechen
              </button>
            </>
          ) : (
            <button className="button" type="button" onClick={start} disabled={mode === "sidebar"}>
              Firmenreihenfolge bearbeiten
            </button>
          )}
        </div>
      )}
      {message && !editing && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <DirectoryOrderRows listings={shown} categories={categories} basePath={basePath} showVerification={showVerification}
        editing={editing} busy={busy} dragged={dragged} target={target}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onMove={(from, to) => setDraft((ids) => moveDirectoryId(ids, from, to))} />
    </div>
  );
}
