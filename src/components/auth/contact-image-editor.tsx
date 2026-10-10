"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ContactPerson } from "@/components/portal/contact-person";
import { uploadAdminMedia } from "@/lib/admin-media-upload";
import type { MediaState } from "@/lib/company-media";
import type { Listing } from "@/types/portal";
import { useMediaLibrary } from "@/components/admin/media-library-context";
import Image from "next/image";
import { ImageCropControls } from "@/components/admin/image-crop-controls";
import { DEFAULT_IMAGE_CROP, imageCropStyle, type ImageCrop } from "@/lib/image-crop";
import { squareMediaFile } from "@/lib/square-media";
import styles from "./contact-image-editor.module.css";

export function ContactImageEditor({ contact, save, disabled = false, onBusyChange }: {
  contact: Listing["contact"]; save: (form: FormData) => Promise<MediaState>; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const library = useMediaLibrary();
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);
  const [status, setStatus] = useState<MediaState>({});
  const [progress, setProgress] = useState("");
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [cropUrl, setCropUrl] = useState("");
  const [crop, setCrop] = useState<ImageCrop>({ ...DEFAULT_IMAGE_CROP });
  useEffect(() => { return () => { if (cropUrl) URL.revokeObjectURL(cropUrl); }; }, [cropUrl]);
  const editButton = useRef<HTMLButtonElement>(null);
  function closeCrop() { setCropSource(null); setCropUrl(""); editButton.current?.focus(); }
  async function openCrop() {
    if (lock.current || disabled || !contact.personImage) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setStatus({}); setProgress("Bild wird geladen …");
    try {
      const response = await fetch(contact.personImage.src);
      if (!response.ok) throw new Error("Image unavailable");
      const blob = await response.blob();
      if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type)) throw new Error("Invalid image");
      const file = new File([blob], "ansprechpartner-original", { type: blob.type });
      setCropSource(file); setCropUrl(URL.createObjectURL(file)); setCrop({ ...DEFAULT_IMAGE_CROP });
    } catch { setStatus({ error: "Das Bild konnte nicht geladen werden. Bitte versuchen Sie es erneut." }); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); setProgress(""); }
  }
  async function run(file?: File, selectedCrop?: ImageCrop) {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setStatus({});
    try {
      if (file && selectedCrop) file = await squareMediaFile(file, "gallery", selectedCrop);
      if (file) setPreview(URL.createObjectURL(file));
      const form = new FormData(); form.set("intent", "contact-remove");
      const result = file ? await uploadAdminMedia(save, "contact", file, "", setProgress) : await save(form);
      setStatus(result);
      if (result.success) { closeCrop(); router.refresh(); }
    } catch { setStatus({ error: "Das Ansprechpartnerbild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." }); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); setProgress(""); setPreview(null); }
  }
  async function applyCrop() {
    if (!cropSource || lock.current || disabled) return;
    // The same square export as gallery crops; the round preview clips these exact pixels.
    await run(cropSource, crop);
  }
  return <div className={styles.editor} aria-busy={busy}>
    <ContactPerson contact={preview ? { ...contact, personImage: { src: preview, alt: "Vorschau des Ansprechpartnerbildes" } } : contact} />
    {!contact.personImage && !preview && <div className={styles.placeholder}>Kein Ansprechpartnerbild</div>}
    <div className={styles.actions}>
    <button type="button" className="button" disabled={disabled || busy} onClick={() => library ? library.open({kind:"contact"}) : input.current?.click()}>{contact.personImage ? "Ansprechpartnerbild ändern" : "Ansprechpartnerbild hinzufügen"}</button>
    <input ref={input} type="file" hidden aria-label="Ansprechpartnerbild auswählen" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void run(file); }} />
    {contact.personImage && <button type="button" className="button" disabled={disabled || busy} onClick={() => void run()}>Ansprechpartnerbild entfernen</button>}
    {contact.personImage && <button ref={editButton} type="button" className="button" disabled={disabled || busy} aria-expanded={Boolean(cropSource)} onClick={() => void openCrop()}>Ansprechpartnerbild bearbeiten</button>}
    </div>
    {cropSource && <div className={styles.crop} onKeyDown={event => { if (event.key === "Escape" && !busy) { event.preventDefault(); closeCrop(); } }}>
      <ImageCropControls crop={crop} setCrop={setCrop} ratio={1} shape="circle" alt="Ansprechpartnerbild" disabled={busy || disabled}
        renderImage={value => <Image src={cropUrl} alt="Ausschnitt des Ansprechpartnerbildes" fill unoptimized sizes="320px" style={imageCropStyle(value)} />}>
        <button type="button" className="button primary" disabled={busy || disabled} onClick={() => void applyCrop()}>Ausschnitt speichern</button>
        <button type="button" className="button" disabled={busy} onClick={closeCrop}>Abbrechen</button>
      </ImageCropControls>
    </div>}
    <p>JPG, PNG oder WebP · maximal 5 MB nach Bildoptimierung</p>
    {busy && <p role="status">{progress || "Bild wird gespeichert …"}</p>}
    {status.error && <p role="alert">{status.error}</p>}
    {status.success && <p role="status">{status.success}</p>}
  </div>;
}
