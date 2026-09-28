"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/portal/company-image";
import { ImageGallery } from "@/components/portal/image-gallery";
import { uploadAdminMedia } from "@/lib/admin-media-upload";
import { GALLERY_LIMIT, type MediaRow, type MediaState, type SignedMedia } from "@/lib/company-media";
import styles from "./admin-media.module.css";
import inline from "./inline-profile.module.css";
import { squareMediaFile } from "@/lib/square-media";
import { DEFAULT_IMAGE_CROP, panImageCrop, type ImageCrop } from "@/lib/image-crop";

export function useInlineAdminMedia({ saveAction, media, rows, profileName, initials }: {
  saveAction: (form: FormData) => Promise<MediaState>;
  media: SignedMedia;
  rows: MediaRow[];
  profileName: string;
  initials: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [kind, setKind] = useState<"logo" | "gallery">("gallery");
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<MediaState>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [crop, setCrop] = useState<ImageCrop>({ ...DEFAULT_IMAGE_CROP });
  const drag = useRef<{ x: number; y: number; crop: ImageCrop } | null>(null);
  useEffect(() => {
    if (previewUrl) return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  const rowById = new Map(rows.map((row) => [row.id, row]));

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
  function openUpload(next: "logo" | "gallery") {
    if (busyRef.current) return;
    setFeedback({});
    setKind(next);
    setSelectedFile(null);
    setPreviewUrl("");
    setCrop({ ...DEFAULT_IMAGE_CROP });
    dialog.current?.showModal();
  }
  async function mutate(intent: string, imageId?: string, alt?: string) {
    if (!begin("Änderung wird gespeichert …")) return;
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
  async function upload(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!begin("Upload wird vorbereitet …")) return;
    const form = new FormData(event.currentTarget);
    try {
      const file = selectedFile ?? form.get("file");
      if (!(file instanceof File)) { setFeedback({ error: "Bitte wählen Sie eine Bilddatei." }); return; }
      setBusy("Bildausschnitt wird erstellt …");
      const cropped = await squareMediaFile(file, kind, crop);
      const result = await uploadAdminMedia(saveAction, kind, cropped, String(form.get("alt_text") ?? ""), setBusy);
      setFeedback(result);
      if (result.success) {
        dialog.current?.close();
        router.refresh();
      }
    } catch (error) {
      setFeedback({ error: error instanceof Error ? error.message : "Das Bild konnte nicht verarbeitet werden." });
    } finally {
      end();
    }
  }

  const logoEditor = (
    <div className={inline.logoEditor}>
      <div className="contact-logo" aria-label={media.logo ? `Logo von ${profileName}` : `Initialen ${profileName}`}>
        <CompanyLogo image={media.logo} initials={initials} />
      </div>
      <div className={inline.mediaButtons}>
        <button type="button" className="button" disabled={Boolean(busy)} onClick={() => openUpload("logo")}>{media.logo ? "Logo ändern" : "Logo hinzufügen"}</button>
        {media.logo && <button type="button" className="button" disabled={Boolean(busy)} onClick={() => void mutate("logo-remove")}>Logo entfernen</button>}
      </div>
    </div>
  );
  const galleryEditor = (
    <section className={inline.galleryEditor} aria-label="Bildergalerie bearbeiten">
      {media.images.length ? (
        <ImageGallery
          key={media.images.map((image) => image.id).join("|")}
          images={media.images}
          isDemo={false}
          autoplay={false}
          detailControls={media.images.map((image) => (
            <div key={image.id} className={inline.galleryControls}>
              <form key={`${image.id}-${rowById.get(image.id)?.alt_text ?? ""}`} onSubmit={(event) => {
                event.preventDefault();
                void mutate("gallery-alt", image.id, String(new FormData(event.currentTarget).get("alt_text") ?? ""));
              }}>
                <label htmlFor={`inline-alt-${image.id}`}>Bildbeschreibung</label>
                <input id={`inline-alt-${image.id}`} name="alt_text" defaultValue={rowById.get(image.id)?.alt_text ?? ""} maxLength={500} disabled={Boolean(busy)} placeholder="Was ist auf dem Bild zu sehen?" />
                <button type="submit" className="button" disabled={Boolean(busy)}>Alt-Text speichern</button>
              </form>
              <button type="button" className="button" disabled={Boolean(busy)} onClick={() => void mutate("gallery-remove", image.id)}>Bild löschen</button>
            </div>
          ))}
          addControl={media.images.length < GALLERY_LIMIT ? <button type="button" className="button" disabled={Boolean(busy)} onClick={() => openUpload("gallery")}>Bild hinzufügen</button> : undefined}
        />
      ) : <div className={inline.emptyGallery}><p>Noch keine Bilder vorhanden.</p><button type="button" className="button" disabled={Boolean(busy)} onClick={() => openUpload("gallery")}>Galeriebild hinzufügen</button></div>}
    </section>
  );
  const status = <div className={inline.status} aria-live="polite">
    {busy && <p role="status"><span className={styles.spinner} aria-hidden="true" />{busy}</p>}
    {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
    {feedback.success && <p role="status" className={styles.success}>{feedback.success}</p>}
  </div>;
  const uploadDialog = (
    <dialog ref={dialog} className={styles.dialog} onCancel={(event) => { if (busyRef.current) event.preventDefault(); }}>
      <form onSubmit={upload}>
        <div className={styles.dialogHeading}>
          <h2>{kind === "logo" ? "Logo auswählen" : "Bild hinzufügen"}</h2>
          <button type="button" disabled={Boolean(busy)} aria-label="Dialog schließen" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <p>JPG, PNG oder WebP · Original bis 30 MB · quadratischer Ausschnitt für die Vorschau</p>
        <label className={styles.uploadField}>Bilddatei<input type="file" name="file" required accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)}
          onChange={(event) => { const file = event.target.files?.[0] ?? null;
            setSelectedFile(file); setPreviewUrl(file ? URL.createObjectURL(file) : "");
            setCrop({ ...DEFAULT_IMAGE_CROP }); setFeedback({}); }} /></label>
        {previewUrl && <div className={inline.squareCropEditor}>
          <p>{kind === "logo" ? "Logo vollständig im Rahmen positionieren. Transparenz bleibt erhalten." : "Bildausschnitt im Rahmen positionieren."}</p>
          <div className={inline.squareCropFrame} role="img" aria-label="Quadratischer Bildausschnitt"
            onPointerDown={(event: PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, crop }; }}
            onPointerMove={(event: PointerEvent<HTMLDivElement>) => { if (!drag.current) return; const rect = event.currentTarget.getBoundingClientRect();
              setCrop(panImageCrop(drag.current.crop, event.clientX - drag.current.x, event.clientY - drag.current.y, rect.width, rect.height)); }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
            {/* Blob URLs are local preview data; the saved image goes through the existing secure media upload. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="" style={{ objectFit: kind === "logo" ? "contain" : "cover",
              objectPosition: `${crop.focus_x}% ${crop.focus_y}%`, transform: `scale(${crop.zoom})`,
              transformOrigin: `${crop.focus_x}% ${crop.focus_y}%` }} />
          </div>
          <label>Zoom {Math.round(crop.zoom * 100)} %<input type="range" min="1" max="3" step="0.05" value={crop.zoom}
            onChange={(event) => setCrop((old) => ({ ...old, zoom: Number(event.target.value) }))} /></label>
          <button type="button" className="button" onClick={() => setCrop({ ...DEFAULT_IMAGE_CROP })}>Ausschnitt zurücksetzen</button>
        </div>}
        {kind === "gallery" && <label className={styles.uploadField}>Bildbeschreibung (optional)<input type="text" name="alt_text" maxLength={500} disabled={Boolean(busy)} placeholder="Was ist auf dem Bild zu sehen?" /></label>}
        {busy && <p role="status" className={styles.feedback}><span className={styles.spinner} aria-hidden="true" />{busy}</p>}
        {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
        <div className={styles.actions}>
          <button type="button" className="button" disabled={Boolean(busy)} onClick={() => dialog.current?.close()}>Abbrechen</button>
          <button className="button button-primary" disabled={Boolean(busy) || !selectedFile}>{busy ? "Bild wird hochgeladen …" : "Ausschnitt übernehmen & hochladen"}</button>
        </div>
      </form>
    </dialog>
  );
  return { logoEditor, galleryEditor, status, uploadDialog, busy: Boolean(busy) };
}
