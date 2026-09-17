"use client";
import { createClient } from "@/lib/supabase/client";
import type { MediaState } from "@/lib/company-media";
import { useActionState, useRef, useState } from "react";
import { saveCompanyMedia } from "@/app/(energieheld)/firma/profil/media-actions";
import { CompanyLogo } from "@/components/portal/company-image";
import { ImageGallery } from "@/components/portal/image-gallery";
import { ListingDetail } from "@/components/portal/listing-detail";
import { energieheld } from "@/config/energieheld";
import type { Listing } from "@/types/portal";
import type { SignedMedia } from "@/lib/company-media";

export function CompanyProfileDesigner({
  listing,
  media,
}: {
  listing: Listing;
  media: SignedMedia;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [uploadKind, setUploadKind] = useState("gallery-upload");
  function openUpload(kind: string) {
    setUploadKind(kind);
    dialog.current?.showModal();
  }
  const [state, action, pending] = useActionState<MediaState, FormData>(
    async (_previous, form) => {
      const intent = form.get("intent");
      if (intent !== "logo-upload" && intent !== "gallery-upload")
        return saveCompanyMedia({}, form);
      const file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 5242880)
        return { error: "Bitte wählen Sie eine Bilddatei mit maximal 5 MB." };
      let path: string | undefined;
      const storage = createClient().storage.from("company-media");
      try {
        const prepare = new FormData();
        prepare.set(
          "intent",
          intent === "logo-upload" ? "prepare-logo" : "prepare-gallery",
        );
        prepare.set("file_type", file.type);
        prepare.set("file_size", String(file.size));
        const prepared = await saveCompanyMedia({}, prepare);
        if (!prepared.uploadPath) return prepared;
        path = prepared.uploadPath;
        const upload = await storage.upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upload.error) throw new Error("Upload failed");
        const finish = new FormData();
        finish.set("intent", intent);
        finish.set("uploaded_path", path);
        finish.set("alt_text", String(form.get("alt_text") ?? ""));
        const result = await saveCompanyMedia({}, finish);
        if (result.error) await storage.remove([path]);
        if (result.success) dialog.current?.close();
        return result;
      } catch {
        if (path) {
          try {
            await storage.remove([path]);
          } catch {
            /* An orphan stays private. */
          }
        }
        return {
          error:
            "Das Bild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
        };
      }
    },
    {},
  );

  const logoEditor = (
    <div className="logo-editor">
      <button
        type="button"
        className="detail-logo logo-upload-target"
        disabled={pending}
        aria-label={media.logo ? "Logo ändern" : "Firmenlogo hinzufügen"}
        onClick={() => openUpload("logo-upload")}
      >
        {media.logo ? (
          <>
            <CompanyLogo
              key={media.logo.src}
              image={media.logo}
              initials={listing.initials}
            />
            <span className="logo-edit-overlay">
              <span aria-hidden="true">↥</span> Logo ändern
            </span>
          </>
        ) : (
          <span>
            <span className="media-plus" aria-hidden="true">
              ＋
            </span>
            Firmenlogo hinzufügen
          </span>
        )}
      </button>
      {media.logo && (
        <form action={action} className="logo-remove-action">
          <button
            name="intent"
            value="logo-remove"
            disabled={pending}
            aria-label="Logo entfernen"
          >
            Entfernen
          </button>
        </form>
      )}
    </div>
  );
  const addTile = (
    <button
      type="button"
      className="gallery-add-tile"
      disabled={pending || media.images.length >= 8}
      aria-label={
        media.images.length >= 8
          ? "Alle 8 Bildplätze sind belegt"
          : "Bild hinzufügen"
      }
      onClick={() => openUpload("gallery-upload")}
    >
      <span aria-hidden="true">＋</span>
      {media.images.length >= 8 ? "8 von 8 Bildern" : "Bild hinzufügen"}
    </button>
  );
  const galleryEditor = (
    <section
      className="gallery-editor"
      aria-label="Unternehmensbilder gestalten"
    >
      {media.images.length ? (
        <ImageGallery
          key={media.images.map((image) => image.src).join("|")}
          images={media.images}
          isDemo={false}
          addControl={addTile}
          controls={media.images.map((image) => (
            <form key={image.id} action={action} className="media-actions">
              <input type="hidden" name="image_id" value={image.id} />
              <button
                name="intent"
                value="gallery-remove"
                disabled={pending}
                aria-label="Ausgewähltes Bild löschen"
              >
                Bild löschen
              </button>
            </form>
          ))}
          thumbnailControls={media.images.map((image, index) => (
            <form key={image.id} action={action}>
              <input type="hidden" name="image_id" value={image.id} />
              <button
                name="intent"
                value="gallery-up"
                disabled={pending || index === 0}
                aria-label={`Bild ${index + 1} nach links verschieben`}
                title="Bild nach links verschieben"
              >
                ←
              </button>
              <button
                name="intent"
                value="gallery-down"
                disabled={pending || index === media.images.length - 1}
                aria-label={`Bild ${index + 1} nach rechts verschieben`}
                title="Bild nach rechts verschieben"
              >
                →
              </button>
            </form>
          ))}
        />
      ) : (
        <div className="gallery-empty">
          <strong>Unternehmensbilder hinzufügen</strong>
          <p>Zeigen Sie Referenzen, Projekte oder Ihr Unternehmen.</p>
          {addTile}
        </div>
      )}
    </section>
  );
  return (
    <>
      {pending && (
        <p className="profile-editor-feedback" role="status">
          Bild wird gespeichert …
        </p>
      )}
      {state.error && (
        <p className="profile-editor-feedback" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="profile-editor-feedback" role="status">
          {state.success}
        </p>
      )}
      <ListingDetail
        listing={listing}
        categories={energieheld.categories}
        presentation="company"
        logoEditor={logoEditor}
        galleryEditor={galleryEditor}
      />
      <dialog
        ref={dialog}
        className="profile-upload-dialog"
        aria-labelledby="profile-upload-title"
      >
        <form action={action} key={uploadKind}>
          <div className="upload-dialog-heading">
            <h2 id="profile-upload-title">
              {uploadKind === "logo-upload"
                ? "Firmenlogo auswählen"
                : "Unternehmensbild hinzufügen"}
            </h2>
            <button
              type="button"
              className="dialog-close"
              aria-label="Dialog schließen"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </div>
          <p id="upload-file-help">
            JPG, PNG oder WebP · maximal 5 MB
            {uploadKind === "gallery-upload" ? " · bis zu 8 Bilder" : ""}
          </p>
          <input type="hidden" name="intent" value={uploadKind} />
          <label className="upload-field">
            Bilddatei
            <input
              type="file"
              name="file"
              required
              accept="image/jpeg,image/png,image/webp"
              disabled={pending}
              aria-describedby="upload-file-help"
            />
          </label>
          {uploadKind === "gallery-upload" && (
            <label className="upload-field">
              Bildbeschreibung (optional)
              <input
                type="text"
                name="alt_text"
                maxLength={500}
                disabled={pending}
                placeholder="Was ist auf dem Bild zu sehen?"
              />
            </label>
          )}
          {state.error && (
            <p role="alert" className="profile-editor-feedback">
              {state.error}
            </p>
          )}
          <div className="upload-dialog-actions">
            <button
              type="button"
              className="button button-outline"
              onClick={() => dialog.current?.close()}
            >
              Abbrechen
            </button>
            <button className="button button-primary" disabled={pending}>
              {pending ? "Wird hochgeladen …" : "Bild hochladen"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
