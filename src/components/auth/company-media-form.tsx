"use client";
import { createClient } from "@/lib/supabase/client";
import type { MediaState } from "@/lib/company-media";
import { useActionState } from "react";
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
      <form action={action}>
        <input type="hidden" name="intent" value="logo-upload" />
        <label className="detail-logo logo-upload-target">
          {media.logo ? (
            <CompanyLogo
              key={media.logo.src}
              image={media.logo}
              initials={listing.initials}
            />
          ) : (
            <span>
              <span aria-hidden="true">＋</span>
              <br />
              Firmenlogo hinzufügen
            </span>
          )}
          <input
            className="media-file-input"
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending}
            aria-label={media.logo ? "Logo ändern" : "Firmenlogo hinzufügen"}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          />
        </label>
        {media.logo && (
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            Zum Ändern auf das Logo klicken
          </p>
        )}
      </form>
      {media.logo && (
        <form action={action} className="media-actions">
          <button name="intent" value="logo-remove" disabled={pending}>
            Logo entfernen
          </button>
        </form>
      )}
      <p className="small muted" style={{ fontSize: 11, margin: "8px 0 0" }}>
        JPG, PNG oder WebP · max. 5 MB
      </p>
    </div>
  );
  const uploadBar = (
    <form action={action} className="gallery-upload-bar">
      <input type="hidden" name="intent" value="gallery-upload" />
      <label>
        Bildbeschreibung (optional)
        <input
          type="text"
          name="alt_text"
          maxLength={500}
          disabled={pending || media.images.length >= 8}
        />
      </label>
      <label className="media-upload-link">
        ＋{" "}
        {media.images.length ? "Weiteres Bild hinzufügen" : "Bilder auswählen"}
        <input
          className="media-file-input"
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending || media.images.length >= 8}
          aria-label="Unternehmensbild hinzufügen"
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
        />
      </label>
    </form>
  );
  const galleryEditor = (
    <section
      className="gallery-editor"
      aria-label="Unternehmensbilder gestalten"
    >
      {media.images.length ? (
        <>
          <ImageGallery
            key={media.images.map((image) => image.src).join("|")}
            images={media.images}
            isDemo={false}
            controls={media.images.map((image, index) => (
              <form key={image.id} action={action} className="media-actions">
                <input type="hidden" name="image_id" value={image.id} />
                <button
                  name="intent"
                  value="gallery-up"
                  disabled={pending || index === 0}
                  aria-label={"Bild " + (index + 1) + " nach links"}
                >
                  ← Nach links
                </button>
                <button
                  name="intent"
                  value="gallery-down"
                  disabled={pending || index === media.images.length - 1}
                  aria-label={"Bild " + (index + 1) + " nach rechts"}
                >
                  Nach rechts →
                </button>
                <button name="intent" value="gallery-remove" disabled={pending}>
                  Bild löschen
                </button>
              </form>
            ))}
          />
          {uploadBar}
        </>
      ) : (
        <div className="gallery-empty">
          <strong>Unternehmensbilder hinzufügen</strong>
          <p>Zeigen Sie Referenzen, Projekte oder Ihr Unternehmen.</p>
          {uploadBar}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>
        Bis zu 8 Bilder · JPG, PNG oder WebP · maximal 5 MB pro Bild
      </p>
      {media.images.length >= 8 && (
        <p className="small">
          Alle 8 Bildplätze sind belegt. Zum Hinzufügen bitte zuerst ein Bild
          löschen.
        </p>
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
    </>
  );
}
