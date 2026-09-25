"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProfileContentBlock } from "@/lib/profile-content";
import { ProfileBlockImage } from "@/components/portal/profile-content-blocks";
import { hasPersistedImageCrop, normalizeImageCrop, type ImageCrop } from "@/lib/image-crop";
import { imageCaptionPresentation } from "@/lib/image-caption";
import type { EditorHistoryEntry } from "@/lib/editor-history";
import { useInlineEditorHistory } from "./inline-editor-history";
import { InlineImageCropEditor } from "./inline-image-crop-editor";
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
  const history = useInlineEditorHistory();
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
  const [activeCropId, setActiveCropId] = useState<string | null>(null);
  const images = block.images ?? [];
  const activeImage = images.find((image) => image.id === activeCropId);
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
  async function run(data: FormData, entry?: EditorHistoryEntry): Promise<boolean> {
    if (busyRef.current || history.busy) return false;
    busyRef.current = true;
    setBusy(true);
    setFeedback({});
    try {
      const result = await saveAction(data);
      setFeedback(result);
      if (result.success) {
        if (entry) history.record(entry, true);
        if (data.get("intent") === "remove") history.clear();
        router.refresh();
      }
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
    if (!await run(data, { kind: "image-size", blockId: block.id,
      before: { width_percent: config.width_percent, aspect_ratio: config.aspect_ratio },
      after: { width_percent: width, aspect_ratio: ratio } })) resetPreview();
  }
  async function saveCrop(imageId: string, crop: ImageCrop) {
    const data = form("crop");
    data.set("image_id", imageId);
    data.set("focus_x", String(crop.focus_x));
    data.set("focus_y", String(crop.focus_y));
    data.set("zoom", String(crop.zoom));
    const image = images.find((item) => item.id === imageId);
    return run(data, image ? { kind: "crop", blockId: block.id, imageId,
      before: normalizeImageCrop(image), after: crop } : undefined);
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
      if (result.success) {
        history.clear();
        if (imageId === activeCropId) setActiveCropId(null);
        router.refresh();
      }
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
    void run(data, { kind: "image-order", blockId: block.id,
      before: images.map((image) => image.id), after: ids });
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
        aria-pressed={columns === count} disabled={busy || history.busy || count < images.length}
        title={count < images.length ? "Bitte zuerst Bilder entfernen" : `${count} ${count === 1 ? "Bild" : "Bilder"}`}
        onClick={() => { const data = form("layout"); data.set("columns", String(count));
          void run(data, { kind: "image-layout", blockId: block.id, before: columns, after: count }); }}>
        {count} {count === 1 ? "Bild" : "Bilder"}
      </button>)}
    </div>
    <div ref={frameRef} className={`${gridStyles.frame} ${styles.resizableImageFrame}`}>
    <div ref={gridRef} className={`${gridStyles.grid} ${styles.editImageGrid}`} data-columns={columns}>
      {imageGridSlots(columns, images).map((image, index) => image ? <figure key={image.id} className={styles.imageTile}
        onDragOver={(event) => { if (dragId.current && dragId.current !== image.id) event.preventDefault(); }}
        onDrop={(event) => { event.preventDefault(); dropOn(image.id); }}>
        <div className={gridStyles.tile} style={{ aspectRatio: size.ratio }}><ProfileBlockImage image={image} /></div>
        {imageCaptionPresentation(image).caption && <figcaption className={gridStyles.caption}>{imageCaptionPresentation(image).caption}</figcaption>}
        <div className={styles.imageTileActions}>
          <span className={`${styles.dragHint} ${styles.imageReorderHandle}`}
            draggable={!busy && !history.busy && images.length > 1}
            onDragStart={(event) => { dragId.current = image.id; event.dataTransfer.effectAllowed = "move"; }}
            onDragEnd={() => { dragId.current = null; }}>↔ Zum Sortieren ziehen</span>
          <button type="button" className="button" aria-label={`Bild ${index + 1} nach links`} disabled={busy || history.busy || index === 0}
            onClick={() => shift(image.id, -1)}>←</button>
          <button type="button" className="button" aria-label={`Bild ${index + 1} nach rechts`} disabled={busy || history.busy || index === images.length - 1}
            onClick={() => shift(image.id, 1)}>→</button>
        </div>
        <button type="button" className="button" disabled={busy || history.busy || !hasPersistedImageCrop(image)}
          title={!hasPersistedImageCrop(image) ? "Nach Datenbankaktualisierung verfügbar" : undefined}
          onClick={() => setActiveCropId(image.id)}>Ausschnitt bearbeiten</button>
        {!hasPersistedImageCrop(image) && <small role="status">Ausschnitt nach Datenbankaktualisierung verfügbar.</small>}
        <label className={styles.imageUpload}>Bild ersetzen
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || history.busy}
            onChange={(event) => { void upload(event.target.files?.[0], image.id); event.target.value = ""; }} />
        </label>
        <form className={styles.imageAlt} onSubmit={(event) => {
          event.preventDefault();
          const data = form("caption");
          data.set("image_id", image.id);
          const caption = String(new FormData(event.currentTarget).get("caption") ?? "");
          data.set("caption", caption);
          void run(data, { kind: "caption", blockId: block.id, imageId: image.id,
            before: image.caption ?? null, after: caption.trim() || null });
        }}>
          <label>Text unter dem Bild
            <textarea name="caption" key={`${image.id}-${image.caption}`} defaultValue={image.caption ?? ""}
              maxLength={500} rows={2} disabled={busy || history.busy || !("caption" in image)} />
          </label>
          <button type="submit" className="button" disabled={busy || history.busy || !("caption" in image)}>Text speichern</button>
          {!("caption" in image) && <small role="status">Nach Datenbankaktualisierung verfügbar.</small>}
        </form>
        <button type="button" className="button" disabled={busy || history.busy} onClick={() => {
          if (!window.confirm("Dieses Bild wirklich löschen?")) return;
          if (activeCropId === image.id) setActiveCropId(null);
          const data = form("remove"); data.set("image_id", image.id); void run(data);
        }}>Bild löschen</button>
      </figure> : <label key={`empty-${index}`} className={styles.emptyImageTile} style={{ aspectRatio: size.ratio }}>
        <span>+ Bild hinzufügen</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || history.busy}
          onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
      </label>)}
    </div>
    {resizeAvailable && <div className={styles.resizeFooter}>
      <div className={styles.resizeButtons} role="group" aria-label="Bildhöhe">
        <button type="button" className="button" aria-label="Bildblock flacher" disabled={busy || history.busy || size.ratio >= 3}
          onClick={() => adjustSize(0.1)}>Höhe −</button>
        <button type="button" className="button" aria-label="Bildblock höher" disabled={busy || history.busy || size.ratio <= 0.6}
          onClick={() => adjustSize(-0.1)}>Höhe +</button>
      </div>
      <small role="status">Bildhöhe anpassen</small>
      <button type="button" className={styles.resizeGrip} aria-label="Bildhöhe durch Ziehen ändern"
        title="Bildhöhe ändern" disabled={busy || history.busy}
        onPointerDown={startResize} onPointerMove={moveResize}
        onPointerUp={(event) => { moveResize(event); finishResize(event); }}
        onPointerCancel={(event) => finishResize(event, true)}>↘</button>
    </div>}
    </div>
    {activeImage && hasPersistedImageCrop(activeImage) && <InlineImageCropEditor key={activeImage.id}
      image={activeImage} ratio={size.ratio} save={saveCrop} cancel={() => setActiveCropId(null)} />}
    {progress && <p role="status">{progress}</p>}
    {busy && !progress && <p role="status">Änderung wird gespeichert …</p>}
    {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
    {feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
  </div>;
}
