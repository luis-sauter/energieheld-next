"use client";
import { useRef, type PointerEvent, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { centerImageCrop, DEFAULT_IMAGE_CROP, nudgeImageCrop, panImageCrop, zoomImageCrop, type ImageCrop } from "@/lib/image-crop";
import styles from "./inline-profile.module.css";
export function ImageCropControls({ crop, setCrop, ratio, alt, disabled = false, shape = "square", renderImage, children }: {
 crop: ImageCrop; setCrop: Dispatch<SetStateAction<ImageCrop>>; ratio: number; alt?: string | null; disabled?: boolean;
 shape?: "square" | "circle"; renderImage: (crop: ImageCrop) => ReactNode; children?: ReactNode;
}) {
  const drag = useRef<{ id: number; x: number; y: number; width: number; height: number; crop: ImageCrop } | null>(null);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
      width: rect.width, height: rect.height, crop };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (disabled || !start || start.id !== event.pointerId) return;
    setCrop(panImageCrop(start.crop, event.clientX - start.x, event.clientY - start.y,
      start.width, start.height));
  }
  function finish(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    move(event);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function nudge(direction: "left" | "right" | "up" | "down") {
    setCrop((old) => nudgeImageCrop(old, direction));
  }
  return <div className={styles.cropEditor} aria-label="Bildausschnitt bearbeiten">
    <h3>Ausschnitt bearbeiten</h3>
    <p>Bild im Rahmen ziehen oder mit den Pfeilen verschieben.</p>
    <div className={styles.cropFrame} style={{ aspectRatio: ratio, borderRadius: shape === "circle" ? "50%" : undefined }} role="img"
      aria-label={`Vorschau: ${alt || "Bild"}`}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
      {renderImage(crop)}
    </div>
    <div className={styles.cropControls}>
      <div className={styles.cropArrows} role="group" aria-label="Bild verschieben">
        <button type="button" className="button" aria-label="Bild nach links" disabled={disabled}
          onClick={() => nudge("left")}>←</button>
        <button type="button" className="button" aria-label="Bild nach oben" disabled={disabled}
          onClick={() => nudge("up")}>↑</button>
        <button type="button" className="button" aria-label="Bild nach unten" disabled={disabled}
          onClick={() => nudge("down")}>↓</button>
        <button type="button" className="button" aria-label="Bild nach rechts" disabled={disabled}
          onClick={() => nudge("right")}>→</button>
      </div>
      <div className={styles.cropZoom} role="group" aria-label="Zoom">
        <button type="button" className="button" aria-label="Zoom verringern" disabled={disabled || crop.zoom <= 1}
          onClick={() => setCrop((old) => zoomImageCrop(old, -0.1))}>Zoom −</button>
        <label>Zoom {Math.round(crop.zoom * 100)} %
          <input type="range" min="1" max="3" step="0.05" value={crop.zoom} disabled={disabled}
            aria-label="Bildzoom" onChange={(event) => setCrop((old) => ({ ...old, zoom: Number(event.target.value) }))} />
        </label>
        <button type="button" className="button" aria-label="Zoom erhöhen" disabled={disabled || crop.zoom >= 3}
          onClick={() => setCrop((old) => zoomImageCrop(old, 0.1))}>Zoom +</button>
      </div>
      <button type="button" className="button" disabled={disabled}
        onClick={() => setCrop(centerImageCrop)}>Zentrieren</button>
      <button type="button" className="button" disabled={disabled}
        onClick={() => setCrop({ ...DEFAULT_IMAGE_CROP })}>Zurücksetzen</button>
      {children}
    </div>
  </div>;
}
