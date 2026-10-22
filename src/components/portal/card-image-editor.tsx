"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic.js";
import { saveCardImage } from "@/app/(energieheld)/card-image-actions";
import { DEFAULT_IMAGE_CROP, imageCropStyle, type ImageCrop } from "@/lib/image-crop";
import type { MediaAsset } from "@/lib/media-library";
import type { PortalImage } from "@/types/portal";
import styles from "./accommodation-card.module.css";
const Browser = dynamic(() => import("../admin/media-library-browser").then(module => module.MediaLibraryBrowser));
const CropControls = dynamic(() => import("../admin/image-crop-controls").then(module => module.ImageCropControls));
export function CardImageEditor({ profileId, profileName, crop: savedCrop, image, assetId, onSaved, ratio = 35 / 32, fit = "cover" }: {
  profileId: string; profileName: string; crop?: ImageCrop; image?: PortalImage; assetId?: string;
  onSaved?: (value: { image: PortalImage; assetId: string; crop: ImageCrop }) => void;
  ratio?: number;
  fit?: "cover" | "contain";
}) {
  const dialog = useRef<HTMLDialogElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<{ id: string; src: string; alt: string } | null>(null);
  const [crop, setCrop] = useState<ImageCrop>(savedCrop ?? DEFAULT_IMAGE_CROP);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (!open) return; dialog.current?.showModal(); return () => returnFocus.current?.focus({ preventScroll: true }); }, [open]);
  function close() { if (!busy) dialog.current?.close(); }
  function choose(asset: MediaAsset) {
    if (asset.profile_id !== profileId || !["company-media", "project-media"].includes(asset.bucket_id) || asset.kind === "video" || asset.archived_at || !asset.src)
      throw Error("Bitte wählen Sie ein Bild dieses Unternehmens.");
    setSelected({ id: asset.id, src: asset.src, alt: asset.alt_text || profileName });
    setCrop(asset.id === assetId ? savedCrop ?? DEFAULT_IMAGE_CROP : { ...DEFAULT_IMAGE_CROP });
    setError("");
  }
  async function save() {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      const result = await saveCardImage(profileId, selected.id, crop);
      if (result.error) { setError(result.error); return; }
      onSaved?.({ image: { src: selected.src, alt: selected.alt }, assetId: selected.id, crop });
      returnFocus.current?.dispatchEvent(new CustomEvent("portal-card-saved", { bubbles: true }));
      dialog.current?.close();
    } catch { setError("Speichern ist gerade nicht möglich. Bitte erneut versuchen."); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className={styles.edit} title="Vorschaubild bearbeiten" aria-label="Vorschaubild bearbeiten"
      onClick={event => { returnFocus.current = event.currentTarget; setError(""); setSelected(assetId && image ? { id: assetId, src: image.src, alt: image.alt } : null); setCrop(savedCrop ?? DEFAULT_IMAGE_CROP); setOpen(true); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a3 3 0 0 0-4-4L4 15Z" /></svg>
    </button>
    {open && <dialog ref={dialog} className="media-library-dialog" aria-labelledby="media-library-title"
      onCancel={event => { if (event.target !== event.currentTarget) return; event.preventDefault(); close(); }}
      onClose={event => { if (event.target !== event.currentTarget) return; setOpen(false); setSelected(null); }}>
      {error && <p role="alert">{error}</p>}
      {selected ? <div style={{ padding: "1.5rem" }}><h2 id="media-library-title">Vorschaubild ändern</h2><p>{profileName}</p>
        <p>Das Vorschaubild wird in A–Z und auf den Unterkunftskarten verwendet. Galerie und Medienoriginal bleiben erhalten.</p>
        {fit === "contain" && <p>Bei 100 % ist das ganze Bild sichtbar. Freie Flächen im quadratischen Rahmen bleiben weiß.</p>}
        <CropControls crop={crop} setCrop={setCrop} ratio={ratio} alt={selected.alt} disabled={busy}
          renderImage={value => {
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={selected.src} alt={selected.alt} style={{ ...imageCropStyle(value, fit), background: fit === "contain" ? "#fff" : undefined }} />;
          }} />
        <div className="actions"><button type="button" className="button" disabled={busy} onClick={() => setSelected(null)}>Bild aus Mediathek wählen</button>
          {fit === "contain" && <button type="button" className="button" disabled={busy} onClick={() => setCrop({ ...DEFAULT_IMAGE_CROP })}>Ganzes Bild einpassen</button>}
          <button type="button" className="button" disabled={busy} onClick={close}>Abbrechen</button>
          <button type="button" className="button button-primary" disabled={busy} onClick={save}>{busy ? "Speichert …" : "Vorschaubild speichern"}</button></div>
      </div> : <Browser title="Vorschaubild ändern" initialProfileId={profileId} initialProfileName={profileName} initialKind="images"
        onSelected={choose} onBusy={setBusy} onClose={close} />}
    </dialog>}
  </>;
}
