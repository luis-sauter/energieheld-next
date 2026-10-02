"use client";

import { useRef, useState } from "react";
import { ProfileBlockImage } from "@/components/portal/profile-content-blocks";
import type { ProfileBlockImage as BlockImage } from "@/lib/profile-content";
import { normalizeImageCrop, type ImageCrop } from "@/lib/image-crop";
import { ImageCropControls } from "./image-crop-controls";
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

  return <div>
    <ImageCropControls crop={crop} setCrop={setCrop} ratio={ratio} alt={image.alt_text} disabled={saving}
      renderImage={(crop) => <ProfileBlockImage image={image} crop={crop} />}>
      <button type="button" className="button button-primary" disabled={saving}
        onClick={() => void apply()}>{saving ? "Wird gespeichert …" : "Übernehmen"}</button>
      <button type="button" className="button" disabled={saving} onClick={cancel}>Abbrechen</button>
    </ImageCropControls>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
