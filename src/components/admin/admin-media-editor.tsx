"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadAdminMedia } from "@/lib/admin-media-upload";
import { CompanyImage, CompanyLogo } from "@/components/portal/company-image";
import { ImageGallery } from "@/components/portal/image-gallery";
import { type MediaRow, type MediaState } from "@/lib/company-media";
import { moveImageId } from "@/lib/media-order";
import type { PortalImage } from "@/types/portal";
import { useMediaLibrary } from "./media-library-context";
import styles from "./admin-media.module.css";

type GalleryImage = PortalImage & { id: string };

export function AdminMediaEditor({ saveAction, profileName, logo, images, rows }: {
  saveAction: (form: FormData) => Promise<MediaState>;
  profileName: string;
  logo?: PortalImage;
  images: GalleryImage[];
  rows: MediaRow[];
}) {
  const router = useRouter();
  const library = useMediaLibrary();
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const draggedRef = useRef<string | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const sortedRows = [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id),
  );
  const orderRef = useRef(sortedRows.map((row) => row.id));
  const committedRef = useRef(sortedRows.map((row) => row.id));
  const [order, setOrder] = useState(() => sortedRows.map((row) => row.id));
  const [uploadKind, setUploadKind] = useState<"logo" | "gallery">("gallery");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const rowIds = sortedRows.map((row) => row.id);
  const visibleOrder = [
    ...order.filter((id) => rowIds.includes(id)),
    ...rowIds.filter((id) => !order.includes(id)),
  ];
  const orderedImages = visibleOrder
    .map((id) => images.find((image) => image.id === id))
    .filter((image): image is GalleryImage => Boolean(image));
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const imageById = new Map(images.map((image) => [image.id, image]));

  function begin(label: string) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(label);
    setFeedback({});
    return true;
  }
  function end() {
    busyRef.current = false;
    setBusy("");
  }
  function openUpload(kind: "logo" | "gallery") {
    if (busyRef.current) return;
    if (library) {library.open({kind,capacity:8-images.length});return;}
    setFeedback({});
    setUploadKind(kind);
    dialog.current?.showModal();
  }
  async function mutate(intent: string, imageId?: string, alt?: string) {
    if (!begin("Änderungen werden gespeichert …")) return;
    const form = new FormData();
    form.set("intent", intent);
    if (imageId) form.set("image_id", imageId);
    if (alt !== undefined) form.set("alt_text", alt);
    try {
      const result = await saveAction(form);
      setFeedback(result);
      if (result.success) router.refresh();
    } catch {
      setFeedback({ error: "Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." });
    } finally {
      end();
    }
  }
  async function persistOrder(next: string[]) {
    if (next.join("|") === committedRef.current.join("|")) return;
    if (!begin("Reihenfolge wird gespeichert …")) return;
    const form = new FormData();
    form.set("intent", "gallery-reorder");
    next.forEach((id) => form.append("image_ids", id));
    try {
      const result = await saveAction(form);
      setFeedback(result);
      if (!result.success) {
        setFeedback({ error: result.error ?? "Die Reihenfolge konnte nicht gespeichert werden." });
        orderRef.current = committedRef.current;
        setOrder(committedRef.current);
      } else {
        committedRef.current = next;
        router.refresh();
      }
    } catch {
      orderRef.current = committedRef.current;
      setOrder(committedRef.current);
      setFeedback({ error: "Die Reihenfolge konnte nicht gespeichert werden." });
    } finally {
      end();
    }
  }
  function move(draggedId: string, targetId: string) {
    const next = moveImageId(orderRef.current, draggedId, targetId);
    orderRef.current = next;
    setOrder(next);
    return next;
  }
  function startDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (busyRef.current || event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    orderRef.current = visibleOrder;
    committedRef.current = visibleOrder;
    draggedRef.current = id;
    pointerIdRef.current = event.pointerId;
    lastTargetRef.current = null;
    setDragging(id);
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const id = draggedRef.current;
    if (!id || pointerIdRef.current !== event.pointerId) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-gallery-image-id]");
    const target = hit?.dataset.galleryImageId;
    if (!target || target === id || target === lastTargetRef.current || !orderRef.current.includes(target)) return;
    lastTargetRef.current = target;
    move(id, target);
  }
  function finishDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    if (!draggedRef.current || pointerIdRef.current !== event.pointerId) return;
    draggedRef.current = null;
    pointerIdRef.current = null;
    lastTargetRef.current = null;
    setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) {
      orderRef.current = committedRef.current;
      setOrder(committedRef.current);
    } else void persistOrder(orderRef.current);
  }
  async function upload(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!begin("Upload wird vorbereitet …")) return;
    const form = new FormData(event.currentTarget);
    try {
      const result = await uploadAdminMedia(saveAction, uploadKind, form.get("file"), String(form.get("alt_text") ?? ""), setBusy);
      setFeedback(result);
      if (result.success) {
        dialog.current?.close();
        router.refresh();
      }
    } catch {
      setFeedback({ error: "Das Bild konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut." });
    } finally {
      end();
    }
  }

  return (
    <div className={styles.editor} aria-busy={Boolean(busy)}>
      {busy && <p className={styles.feedback} role="status"><span className={styles.spinner} aria-hidden="true" />{busy}</p>}
      {feedback.error && <p className={styles.error} role="alert">{feedback.error}</p>}
      {feedback.success && <p className={styles.success} role="status">{feedback.success}</p>}

      <section className={styles.section} aria-labelledby="admin-logo-title">
        <h2 id="admin-logo-title">Logo</h2>
        <div className={styles.logoRow}>
          <div className={styles.logoPreview}>
            <CompanyLogo image={logo} initials={profileName.slice(0, 2).toUpperCase()} />
          </div>
          <div className={styles.actions}>
            <button className="button button-primary" type="button" disabled={Boolean(busy)} onClick={() => openUpload("logo")}>{logo ? "Logo ändern" : "Logo hinzufügen"}</button>
            {logo && <button className="button" type="button" disabled={Boolean(busy)} onClick={() => mutate("logo-remove")}>Logo entfernen</button>}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="admin-gallery-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="admin-gallery-title">Bildergalerie</h2><p>{images.length} von 8 Bildern · Ziehen Sie ein Bild am Griff an die gewünschte Stelle.</p></div>
          <button className="button button-primary" type="button" disabled={Boolean(busy) || images.length >= 8} onClick={() => openUpload("gallery")}>Bild hinzufügen</button>
        </div>
        {orderedImages.length ? (
          <>
            <div className="company-profile"><ImageGallery images={orderedImages} isDemo={false} /></div>
            <ol className={styles.cards} aria-label="Reihenfolge der Bilder">
              {visibleOrder.map((id, index) => {
                const row = rowById.get(id);
                const image = imageById.get(id);
                if (!row || !image) return null;
                return (
                  <li key={id} data-gallery-image-id={id} className={`${styles.card} ${dragging === id ? styles.dragging : ""}`}>
                    <div className={styles.cardTop}>
                      <button type="button" className={styles.dragHandle} disabled={Boolean(busy)}
                        onPointerDown={(event) => startDrag(event, id)}
                        onPointerMove={moveDrag}
                        onPointerUp={finishDrag}
                        onPointerCancel={(event) => finishDrag(event, true)}
                        aria-label={`Bild ${index + 1} ziehen`} title="Zum Sortieren ziehen">
                        <CompanyImage image={image} width={112} height={76} />
                        <span aria-hidden="true">⠿ Ziehen</span>
                      </button>
                      <div className={styles.cardActions}>
                        <strong>Bild {index + 1}</strong>
                        <div className={styles.actions}>
                          <button type="button" className="button" disabled={Boolean(busy) || index === 0} onClick={() => { orderRef.current = visibleOrder; committedRef.current = visibleOrder; void persistOrder(move(id, visibleOrder[index - 1])); }} aria-label={`Bild ${index + 1} nach links verschieben`}>←</button>
                          <button type="button" className="button" disabled={Boolean(busy) || index === visibleOrder.length - 1} onClick={() => { orderRef.current = visibleOrder; committedRef.current = visibleOrder; void persistOrder(move(id, visibleOrder[index + 1])); }} aria-label={`Bild ${index + 1} nach rechts verschieben`}>→</button>
                          <button type="button" className="button" disabled={Boolean(busy)} onClick={() => mutate("gallery-remove", id)}>Löschen</button>
                        </div>
                      </div>
                    </div>
                    <form className={styles.altForm} onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void mutate("gallery-alt", id, String(data.get("alt_text") ?? "")); }}>
                      <label htmlFor={`alt-${id}`}>Bildbeschreibung</label>
                      <div className={styles.altControls}>
                        <input id={`alt-${id}`} name="alt_text" defaultValue={row.alt_text ?? ""} maxLength={500} disabled={Boolean(busy)} placeholder="Was ist auf dem Bild zu sehen?" />
                        <button className="button" disabled={Boolean(busy)}>Speichern</button>
                      </div>
                    </form>
                  </li>
                );
              })}
            </ol>
          </>
        ) : <p>Noch keine Bilder vorhanden. Fügen Sie das erste Bild hinzu.</p>}
      </section>

      <dialog ref={dialog} className={styles.dialog} onCancel={(event) => { if (busyRef.current) event.preventDefault(); }}>
        <form onSubmit={upload}>
          <div className={styles.dialogHeading}>
            <h2>{uploadKind === "logo" ? "Logo auswählen" : "Bild hinzufügen"}</h2>
            <button type="button" disabled={Boolean(busy)} aria-label="Dialog schließen" onClick={() => dialog.current?.close()}>×</button>
          </div>
          <p>JPG, PNG oder WebP · Original bis 30 MB · wird vor dem Upload optimiert</p>
          <label className={styles.uploadField}>Bilddatei<input type="file" name="file" required accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} /></label>
          {uploadKind === "gallery" && <label className={styles.uploadField}>Bildbeschreibung (optional)<input type="text" name="alt_text" maxLength={500} disabled={Boolean(busy)} placeholder="Was ist auf dem Bild zu sehen?" /></label>}
          {busy && <p role="status" className={styles.feedback}><span className={styles.spinner} aria-hidden="true" />{busy}</p>}
          {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
          <div className={styles.actions}>
            <button type="button" className="button" disabled={Boolean(busy)} onClick={() => dialog.current?.close()}>Abbrechen</button>
            <button className={`button button-primary ${styles.uploadButton}`} disabled={Boolean(busy)}>{busy ? "Bild wird hochgeladen …" : "Bild hochladen"}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
