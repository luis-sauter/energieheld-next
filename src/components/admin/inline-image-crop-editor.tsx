"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ProfileBlockImage } from "@/components/portal/profile-content-blocks";
import type { ProfileBlockImage as BlockImage } from "@/lib/profile-content";
import { centerImageCrop, DEFAULT_IMAGE_CROP, normalizeImageCrop, nudgeImageCrop,
  panImageCrop, zoomImageCrop, type ImageCrop } from "@/lib/image-crop";
import styles from "./inline-profile.module.css";

export function InlineImageCropEditor({ image, ratio, save, cancel }: {
  image: BlockImage;
  ratio: number;
  save: (imageId: string, crop: ImageCrop) => Promise<boolean>;
  cancel: () => void;
}) {
  const [crop, setCrop] = useState(() => normalizeImageCrop(image));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const drag = useRef<{ id: number; x: number; y: number; width: number; height: number; crop: ImageCrop } | null>(null);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (saving || event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
      width: rect.width, height: rect.height, crop };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    setCrop(panImageCrop(start.crop, event.clientX - start.x, event.clientY - start.y,
      start.width, start.height));
    setError("");
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
    setError("");
  }
  async function apply() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (await save(image.id, crop)) cancel();
      else setError("Der Bildausschnitt konnte nicht gespeichert werden.");
    } catch {
      setError("Der Bildausschnitt konnte nicht gespeichert werden.");
    } finally { savingRef.current = false; setSaving(false); }
  }

  return <div className={styles.cropEditor} aria-label="Bildausschnitt bearbeiten">
    <h3>Ausschnitt bearbeiten</h3>
    <p>Bild im Rahmen ziehen oder mit den Pfeilen verschieben.</p>
    <div className={styles.cropFrame} style={{ aspectRatio: ratio }} role="img"
      aria-label={`Vorschau: ${image.alt_text || "Bild"}`}
      onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}>
      <ProfileBlockImage image={image} crop={crop} />
    </div>
    <div className={styles.cropControls}>
      <div className={styles.cropArrows} role="group" aria-label="Bild verschieben">
        <button type="button" className="button" aria-label="Bild nach links" disabled={saving}
          onClick={() => nudge("left")}>←</button>
        <button type="button" className="button" aria-label="Bild nach oben" disabled={saving}
          onClick={() => nudge("up")}>↑</button>
        <button type="button" className="button" aria-label="Bild nach unten" disabled={saving}
          onClick={() => nudge("down")}>↓</button>
        <button type="button" className="button" aria-label="Bild nach rechts" disabled={saving}
          onClick={() => nudge("right")}>→</button>
      </div>
      <div className={styles.cropZoom} role="group" aria-label="Zoom">
        <button type="button" className="button" aria-label="Zoom verringern" disabled={saving || crop.zoom <= 1}
          onClick={() => setCrop((old) => zoomImageCrop(old, -0.1))}>Zoom −</button>
        <label>Zoom {Math.round(crop.zoom * 100)} %
          <input type="range" min="1" max="3" step="0.05" value={crop.zoom} disabled={saving}
            aria-label="Bildzoom" onChange={(event) => setCrop((old) => ({ ...old, zoom: Number(event.target.value) }))} />
        </label>
        <button type="button" className="button" aria-label="Zoom erhöhen" disabled={saving || crop.zoom >= 3}
          onClick={() => setCrop((old) => zoomImageCrop(old, 0.1))}>Zoom +</button>
      </div>
      <button type="button" className="button" disabled={saving}
        onClick={() => setCrop(centerImageCrop)}>Zentrieren</button>
      <button type="button" className="button" disabled={saving}
        onClick={() => setCrop({ ...DEFAULT_IMAGE_CROP })}>Zurücksetzen</button>
      <button type="button" className="button button-primary" disabled={saving}
        onClick={() => void apply()}>{saving ? "Wird gespeichert …" : "Übernehmen"}</button>
      <button type="button" className="button" disabled={saving} onClick={cancel}>Abbrechen</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
