"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/portal/company-image";
import { ImageGallery } from "@/components/portal/image-gallery";
import { uploadAdminMedia } from "@/lib/admin-media-upload";
import { GALLERY_LIMIT, type MediaRow, type MediaState, type SignedMedia } from "@/lib/company-media";
import styles from "./admin-media.module.css";
import inline from "./inline-profile.module.css";

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
      const result = await uploadAdminMedia(saveAction, kind, form.get("file"), String(form.get("alt_text") ?? ""), setBusy);
      setFeedback(result);
      if (result.success) {
        dialog.current?.close();
        router.refresh();
      }
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
        <p>JPG, PNG oder WebP · maximal 5 MB</p>
        <label className={styles.uploadField}>Bilddatei<input type="file" name="file" required accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} /></label>
        {kind === "gallery" && <label className={styles.uploadField}>Bildbeschreibung (optional)<input type="text" name="alt_text" maxLength={500} disabled={Boolean(busy)} placeholder="Was ist auf dem Bild zu sehen?" /></label>}
        {busy && <p role="status" className={styles.feedback}><span className={styles.spinner} aria-hidden="true" />{busy}</p>}
        {feedback.error && <p role="alert" className={styles.error}>{feedback.error}</p>}
        <div className={styles.actions}>
          <button type="button" className="button" disabled={Boolean(busy)} onClick={() => dialog.current?.close()}>Abbrechen</button>
          <button className="button button-primary" disabled={Boolean(busy)}>{busy ? "Bild wird hochgeladen …" : "Bild hochladen"}</button>
        </div>
      </form>
    </dialog>
  );
  return { logoEditor, galleryEditor, status, uploadDialog, busy: Boolean(busy) };
}
