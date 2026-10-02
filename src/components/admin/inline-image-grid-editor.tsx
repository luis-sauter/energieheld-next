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
import { hasPersistedImageGridSize, imageGridSlots, normalizeImageGridConfig, resizeImageGridFromPointer, editorialImageAspectRatio } from "@/lib/image-grid-layout";
import type { MediaState } from "@/lib/company-media";
import gridStyles from "@/components/portal/profile-content-blocks.module.css";
import styles from "./inline-profile.module.css";

export function InlineImageGridEditor({ block, saveAction, onBusyChange, editorial = false }: {
  block: ProfileContentBlock;
  saveAction: (form: FormData) => Promise<MediaState>;
  onBusyChange?: (busy: boolean) => void;
  editorial?: boolean;
}) {
  const router = useRouter();
  const history = useInlineEditorHistory();
  const busyRef = useRef(false);
  const dragOrder = useRef<{ id: string; pointerId: number; before: string[]; lastTarget: string | null } | null>(null);
  const orderRef = useRef<string[]>([]);
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
  const baseIds = images.map((image) => image.id);
  const baseOrder = baseIds.join("|");
  const [orderOverride, setOrderOverride] = useState<{ base: string; ids: string[] } | null>(null);
  const visibleIds = orderOverride?.base === baseOrder ? orderOverride.ids : baseIds;
  const visibleImages = visibleIds.map((id) => images.find((image) => image.id === id)!).filter(Boolean);
  const activeImage = images.find((image) => image.id === activeCropId);
  const config = normalizeImageGridConfig(block.config);
  const columns = config.columns;
  const [columnOverride, setColumnOverride] = useState<{ base: number; value: number } | null>(null);
  const previewColumns = columnOverride?.base === columns ? columnOverride.value : columns;
  const resizeAvailable = hasPersistedImageGridSize(block.config);
  const [size, setSize] = useState(() => ({ width: config.width_percent, ratio: config.aspect_ratio }));
  const displayRatio = editorial ? editorialImageAspectRatio({ ...config, aspect_ratio: size.ratio }) : size.ratio;
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
    onBusyChange?.(true);
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
      onBusyChange?.(false);
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
    const minimum = editorial ? editorialImageAspectRatio({ ...config, aspect_ratio: 0.6 }) : 0.6;
    const ratio = Math.max(minimum, Math.min(3, Math.round((displayRatio + ratioChange) * 100) / 100));
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
      width: sizeRef.current.width, ratio: displayRatio,
      parentWidth, tileWidth,
    };
  }
  function moveResize(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = resizeDrag.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const next = resizeImageGridFromPointer(drag, 0, event.clientY - drag.y);
    preview(drag.width, editorial ? editorialImageAspectRatio({ ...config, aspect_ratio: next.ratio }) : next.ratio);
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
    onBusyChange?.(true);
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
      onBusyChange?.(false);
      setProgress("");
    }
  }
  async function reorder(ids: string[], before = visibleIds) {
    if (busyRef.current || history.busy || ids.join("|") === before.join("|")) return;
    setOrderOverride({ base: baseOrder, ids });
    const data = form("reorder");
    ids.forEach((id) => data.append("image_ids", id));
    if (!await run(data, { kind: "image-order", blockId: block.id,
      before, after: ids })) setOrderOverride({ base: baseOrder, ids: before });
  }
  function shift(id: string, offset: number) {
    const ids = visibleIds;
    const current = ids.indexOf(id);
    const next = current + offset;
    if (current < 0 || next < 0 || next >= ids.length) return;
    void reorder(moveImageId(ids, id, ids[next]));
  }
  function startOrderDrag(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (busyRef.current || history.busy || event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    orderRef.current = visibleIds;
    dragOrder.current = { id, pointerId: event.pointerId, before: visibleIds, lastTarget: null };
  }
  function moveOrderDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragOrder.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-block-image-id]");
    const target = hit?.dataset.blockImageId;
    if (!target || target === drag.id || target === drag.lastTarget || !orderRef.current.includes(target)) return;
    drag.lastTarget = target;
    orderRef.current = moveImageId(orderRef.current, drag.id, target);
    setOrderOverride({ base: baseOrder, ids: orderRef.current });
  }
  function finishOrderDrag(event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = dragOrder.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragOrder.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) setOrderOverride({ base: baseOrder, ids: drag.before });
    else void reorder(orderRef.current, drag.before);
  }

  return <div className={styles.imageBlock}>
    <div className={styles.layoutButtons} role="group" aria-label="Bildlayout">
      {[1, 2, 3, 4].map((count) => <button key={count} type="button" className="button"
        aria-pressed={previewColumns === count} disabled={busy || history.busy || count < images.length}
        title={count < images.length ? "Bitte zuerst Bilder entfernen" : `${count} ${count === 1 ? "Bild" : "Bilder"}`}
        onClick={() => { setColumnOverride({ base: columns, value: count }); const data = form("layout"); data.set("columns", String(count));
          void run(data, { kind: "image-layout", blockId: block.id, before: columns, after: count }).then((ok) => { if (!ok) setColumnOverride(null); }); }}>
        {count} {count === 1 ? "Bild" : "Bilder"}
      </button>)}
    </div>
    <div ref={frameRef} className={`${gridStyles.frame} ${styles.resizableImageFrame}`}>
    <div ref={gridRef} className={`${gridStyles.grid} ${styles.editImageGrid}`} data-columns={previewColumns}>
      {imageGridSlots(previewColumns, visibleImages).map((image, index) => image ? <figure key={image.id} className={styles.imageTile}
        data-block-image-id={image.id}>
        <div className={gridStyles.tile} style={{ aspectRatio: displayRatio }}><ProfileBlockImage image={image} /></div>
        {imageCaptionPresentation(image).caption && <figcaption className={gridStyles.caption}>{imageCaptionPresentation(image).caption}</figcaption>}
        <div className={styles.imageTileActions}>
          <button type="button" className={`${styles.dragHint} ${styles.imageReorderHandle}`}
            disabled={busy || history.busy || images.length < 2}
            aria-label={`Bild ${index + 1} zum Sortieren ziehen`}
            onPointerDown={(event) => startOrderDrag(event, image.id)}
            onPointerMove={moveOrderDrag}
            onPointerUp={finishOrderDrag}
            onPointerCancel={(event) => finishOrderDrag(event, true)}>↔ Zum Sortieren ziehen</button>
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
      </figure> : <label key={`empty-${index}`} className={styles.emptyImageTile} style={{ aspectRatio: displayRatio }}>
        <span>+ Bild hinzufügen</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || history.busy}
          onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
      </label>)}
    </div>
    {resizeAvailable && <div className={styles.resizeFooter}>
      <div className={styles.resizeButtons} role="group" aria-label="Bildhöhe">
        <button type="button" className="button" aria-label="Bildblock flacher" disabled={busy || history.busy || size.ratio >= 3}
          onClick={() => adjustSize(0.1)}>Höhe −</button>
        <button type="button" className="button" aria-label="Bildblock höher" disabled={busy || history.busy || displayRatio <= (editorial ? editorialImageAspectRatio({ ...config, aspect_ratio: 0.6 }) : 0.6)}
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
      image={activeImage} ratio={displayRatio} save={saveCrop} cancel={() => setActiveCropId(null)} />}
    {progress && <p role="status">{progress}</p>}
    {busy && !progress && <p role="status">Änderung wird gespeichert …</p>}
    {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
    {feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
  </div>;
}
