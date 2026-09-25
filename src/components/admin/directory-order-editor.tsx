"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { energieheld } from "@/config/energieheld";
import { moveDirectoryId, realDirectoryIds } from "@/lib/company-directory-order";
import type { Listing } from "@/types/portal";
import { ListingRow } from "@/components/portal/listing-row";
import styles from "./directory-order-editor.module.css";

export function DirectoryOrderEditor({
  listings,
  saveOrder,
}: {
  listings: Listing[];
  saveOrder: (ids: string[]) => Promise<{ success?: string; error?: string }>;
}) {
  const router = useRouter();
  const real = listings.filter((listing) => !listing.isDemo);
  const demos = listings.filter((listing) => listing.isDemo);
  const initialIds = realDirectoryIds(listings);
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

  const byId = new Map(real.map((listing) => [listing.id, listing]));
  const shown = (editing ? draft : savedIds)
    .map((id) => byId.get(id))
    .filter((listing): listing is Listing => Boolean(listing));

  function start() {
    setDraft(savedIds);
    setMessage("");
    setError("");
    setEditing(true);
  }

  function cancel() {
    setDraft(savedIds);
    setError("");
    setDragged(null);
    setTarget(null);
    dragRef.current = null;
    setEditing(false);
  }

  async function save() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await saveOrder(draft);
      if (!result.success) {
        setError(result.error ?? "Die Reihenfolge konnte nicht gespeichert werden.");
        return;
      }
      setSaved({ key: initialKey, ids: draft });
      setMessage(result.success);
      setEditing(false);
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
      {real.length > 0 && (
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
            <button className="button" type="button" onClick={start}>
              Reihenfolge bearbeiten
            </button>
          )}
        </div>
      )}
      {message && !editing && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className="listing-rows">
        {shown.map((listing, index) => (
          editing ? (
            <div
              key={listing.id}
              data-directory-id={listing.id}
              className={`${styles.editRow} ${dragged === listing.id ? styles.dragging : ""} ${target === listing.id ? styles.dropTarget : ""}`}
            >
              <div className={styles.controls}>
                <button
                  className={styles.handle}
                  type="button"
                  aria-label={`Firma ${listing.name} verschieben`}
                  title="Ziehen, um die Firma zu verschieben"
                  onPointerDown={(event) => onPointerDown(event, listing.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  disabled={busy}
                >↕</button>
                <button type="button" aria-label={`Firma ${listing.name} nach oben`} disabled={busy || index === 0}
                  onClick={() => setDraft((ids) => moveDirectoryId(ids, index, index - 1))}>↑</button>
                <button type="button" aria-label={`Firma ${listing.name} nach unten`} disabled={busy || index === shown.length - 1}
                  onClick={() => setDraft((ids) => moveDirectoryId(ids, index, index + 1))}>↓</button>
              </div>
              <ListingRow listing={listing} categories={energieheld.categories} href={`/experten/${listing.slug}`} />
            </div>
          ) : (
            <ListingRow key={listing.id} listing={listing} categories={energieheld.categories} href={`/experten/${listing.slug}`} />
          )
        ))}
        {demos.map((listing) => (
          <div key={listing.id}>
            {editing && <p className={styles.demoNote}>Beispielprofil – nicht Teil der redaktionellen Reihenfolge</p>}
            <ListingRow listing={listing} categories={energieheld.categories} href={`/experten/${listing.slug}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
