"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ProfileContentBlock } from "@/lib/profile-content";
import { uploadPreparedAdminMedia } from "@/lib/admin-media-upload";
import { moveImageId } from "@/lib/media-order";
import { hasPersistedImageGridSize, imageGridSlots, normalizeImageGridConfig, resizeImageGridFromPointer } from "@/lib/image-grid-layout";
import type { MediaState } from "@/lib/company-media";
import gridStyles from "@/components/portal/profile-content-blocks.module.css";
import styles from "./inline-profile.module.css";

export function InlineImageGridEditor({ block, saveAction }: {
  block: ProfileContentBlock;
  saveAction: (form: FormData) => Promise<MediaState>;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const dragId = useRef<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const resizeDrag = useRef<{
    pointerId: number; x: number; y: number; width: number; ratio: number;
    parentWidth: number; tileWidth: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [feedback, setFeedback] = useState<MediaState>({});
  const images = block.images ?? [];
  const config = normalizeImageGridConfig(block.config);
  const columns = config.columns;
  const resizeAvailable = hasPersistedImageGridSize(block.config);
  const [size, setSize] = useState(() => ({ width: config.width_percent, ratio: config.aspect_ratio }));
  const sizeRef = useRef(size);
  useEffect(() => {
    if (resizeDrag.current) return;
    const next = { width: config.width_percent, ratio: config.aspect_ratio };
    sizeRef.current = next;
    setSize(next);
  }, [config.width_percent, config.aspect_ratio]);

  function preview(width: number, ratio: number) {
    const next = { width, ratio };
    sizeRef.current = next;
    setSize(next);
  }
  function resetPreview() { preview(config.width_percent, config.aspect_ratio); }

  function form(intent: string) {
    const data = new FormData();
    data.set("intent", intent);
    data.set("block_id", block.id);
    return data;
  }
  async function run(data: FormData): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    try {
      const result = await saveAction(data);
      setFeedback(result);
      if (result.success) router.refresh();
      return Boolean(result.success);
    } catch {
      setFeedback({ error: "Die Bildänderung konnte nicht gespeichert werden." });
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  async function saveSize(width: number, ratio: number) {
    if (width === config.width_percent && ratio === config.aspect_ratio) return;
    const data = form("resize");
    data.set("width_percent", String(width));
    data.set("aspect_ratio", String(ratio));
    if (!await run(data)) resetPreview();
  }
  function adjustSize(ratioChange: number) {
    const width = sizeRef.current.width;
    const ratio = Math.max(0.6, Math.min(3, Math.round((sizeRef.current.ratio + ratioChange) * 100) / 100));
    preview(width, ratio);
    void saveSize(width, ratio);
  }
  function startResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (busyRef.current || event.pointerType === "mouse" && event.button !== 0) return;
    const parentWidth = frameRef.current?.closest(".profile-content-canvas")?.getBoundingClientRect().width ?? 0;
    const tileWidth = gridRef.current?.firstElementChild?.getBoundingClientRect().width ?? 0;
    if (!parentWidth || !tileWidth) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDrag.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      width: sizeRef.current.width, ratio: sizeRef.current.ratio,
      parentWidth, tileWidth,
    };
  }
  function moveResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = resizeDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const next = resizeImageGridFromPointer(drag, 0, event.clientY - drag.y);
    preview(drag.width, next.ratio);
  }
  function finishResize(event: ReactPointerEvent<HTMLButtonElement>, cancel = false) {
    const drag = resizeDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    resizeDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancel) resetPreview();
    else void saveSize(sizeRef.current.width, sizeRef.current.ratio);
  }
  async function upload(file: File | undefined, imageId?: string) {
    if (busyRef.current || !file) return;
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    setProgress("Upload wird vorbereitet …");
    const prepare = form("prepare");
    const finish = form("upload");
    if (imageId) { prepare.set("image_id", imageId); finish.set("image_id", imageId); }
    finish.set("alt_text", imageId ? images.find((image) => image.id === imageId)?.alt_text ?? "" : "");
    try {
      const result = await uploadPreparedAdminMedia(saveAction, file, prepare, finish, setProgress);
      setFeedback(result);
      if (result.success) router.refresh();
    } catch {
      setFeedback({ error: "Das Bild konnte nicht hochgeladen werden." });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  function reorder(ids: string[]) {
    const data = form("reorder");
    ids.forEach((id) => data.append("image_ids", id));
    void run(data);
  }
  function shift(id: string, offset: number) {
    const ids = images.map((image) => image.id);
    const current = ids.indexOf(id);
    const next = current + offset;
    if (current < 0 || next < 0 || next >= ids.length) return;
    reorder(moveImageId(ids, id, ids[next]));
  }
  function dropOn(targetId: string) {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const ids = images.map((image) => image.id);
    const next = moveImageId(ids, sourceId, targetId);
    if (next !== ids) reorder(next);
  }

  return <div className={styles.imageBlock}>
    <div className={styles.layoutButtons} role="group" aria-label="Bildlayout">
      {[1, 2, 3, 4].map((count) => <button key={count} type="button" className="button"
        aria-pressed={columns === count} disabled={busy || count < images.length}
        title={count < images.length ? "Bitte zuerst Bilder entfernen" : `${count} ${count === 1 ? "Bild" : "Bilder"}`}
        onClick={() => { const data = form("layout"); data.set("columns", String(count)); void run(data); }}>
        {count} {count === 1 ? "Bild" : "Bilder"}
      </button>)}
    </div>
    <div ref={frameRef} className={`${gridStyles.frame} ${styles.resizableImageFrame}`}>
    <div ref={gridRef} className={`${gridStyles.grid} ${styles.editImageGrid}`} data-columns={columns}>
      {imageGridSlots(columns, images).map((image, index) => image ? <div key={image.id} className={styles.imageTile}
        draggable={!busy && images.length > 1}
        onDragStart={(event) => { dragId.current = image.id; event.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(event) => { if (dragId.current && dragId.current !== image.id) event.preventDefault(); }}
        onDrop={(event) => { event.preventDefault(); dropOn(image.id); }}
        onDragEnd={() => { dragId.current = null; }}>
        <div className={gridStyles.tile} style={{ aspectRatio: size.ratio }}><Image src={image.src} alt={image.alt_text ?? ""} fill unoptimized
          sizes="(max-width: 640px) 100vw, (max-width: 900px) 50vw, 25vw" /></div>
        <div className={styles.imageTileActions}>
          <span className={styles.dragHint}>Ziehen zum Sortieren</span>
          <button type="button" className="button" aria-label={`Bild ${index + 1} nach links`} disabled={busy || index === 0}
            onClick={() => shift(image.id, -1)}>←</button>
          <button type="button" className="button" aria-label={`Bild ${index + 1} nach rechts`} disabled={busy || index === images.length - 1}
            onClick={() => shift(image.id, 1)}>→</button>
        </div>
        <label className={styles.imageUpload}>Bild ersetzen
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={(event) => { void upload(event.target.files?.[0], image.id); event.target.value = ""; }} />
        </label>
        <form className={styles.imageAlt} onSubmit={(event) => {
          event.preventDefault();
          const data = form("alt");
          data.set("image_id", image.id);
          data.set("alt_text", String(new FormData(event.currentTarget).get("alt_text") ?? ""));
          void run(data);
        }}>
          <label>Bildbeschreibung (Alt-Text)
            <input name="alt_text" key={`${image.id}-${image.alt_text}`} defaultValue={image.alt_text ?? ""}
              maxLength={500} disabled={busy} />
          </label>
          <button type="submit" className="button" disabled={busy}>Beschreibung speichern</button>
        </form>
        <button type="button" className="button" disabled={busy} onClick={() => {
          if (!window.confirm("Dieses Bild wirklich löschen?")) return;
          const data = form("remove"); data.set("image_id", image.id); void run(data);
        }}>Bild löschen</button>
      </div> : <label key={`empty-${index}`} className={styles.emptyImageTile} style={{ aspectRatio: size.ratio }}>
        <span>+ Bild hinzufügen</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
          onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
      </label>)}
    </div>
    {resizeAvailable && <div className={styles.resizeFooter}>
      <div className={styles.resizeButtons} role="group" aria-label="Bildhöhe">
        <button type="button" className="button" aria-label="Bildblock flacher" disabled={busy || size.ratio >= 3}
          onClick={() => adjustSize(0.1)}>Höhe −</button>
        <button type="button" className="button" aria-label="Bildblock höher" disabled={busy || size.ratio <= 0.6}
          onClick={() => adjustSize(-0.1)}>Höhe +</button>
      </div>
      <small role="status">Bildhöhe anpassen</small>
      <button type="button" className={styles.resizeGrip} aria-label="Bildhöhe durch Ziehen ändern"
        title="Bildhöhe ändern" disabled={busy}
        onPointerDown={startResize} onPointerMove={moveResize}
        onPointerUp={(event) => { moveResize(event); finishResize(event); }}
        onPointerCancel={(event) => finishResize(event, true)}>↘</button>
    </div>}
    </div>
    {progress && <p role="status">{progress}</p>}
    {busy && !progress && <p role="status">Änderung wird gespeichert …</p>}
    {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
    {feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
  </div>;
}
