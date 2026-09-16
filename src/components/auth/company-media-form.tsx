"use client";
import { createClient } from "@/lib/supabase/client";
import type { MediaState } from "@/lib/company-media";
import { useActionState } from "react";
import { saveCompanyMedia } from "@/app/(energieheld)/firma/profil/media-actions";
import { CompanyImage } from "@/components/portal/company-image";
import type { SignedMedia } from "@/lib/company-media";
import styles from "./auth.module.css";

export function CompanyMediaForm({ media }: { media: SignedMedia }) {
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
  return (
    <section aria-label="Profilmedien" style={{ marginTop: 32 }}>
      <h2>Firmenlogo</h2>
      <p>JPG, PNG oder WebP · maximal 5 MB</p>
      {media.logo ? (
        <CompanyImage key={media.logo.src} image={media.logo} />
      ) : (
        <p>Noch kein Firmenlogo vorhanden.</p>
      )}
      <form action={action} className={styles.form}>
        <fieldset disabled={pending} style={{ border: 0, padding: 0 }}>
          <label className={styles.field}>
            Logo auswählen
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <button
            className="button button-primary"
            name="intent"
            value="logo-upload"
          >
            {pending
              ? "Bitte warten …"
              : media.logo
                ? "Logo ersetzen"
                : "Logo hochladen"}
          </button>
        </fieldset>
      </form>
      {media.logo && (
        <form action={action}>
          <button
            className="button"
            name="intent"
            value="logo-remove"
            disabled={pending}
          >
            Logo entfernen
          </button>
        </form>
      )}
      <h2>Unternehmensbilder</h2>
      <p>Bis zu 8 Bilder · JPG, PNG oder WebP · maximal 5 MB pro Bild</p>
      {!media.images.length && <p>Noch keine Unternehmensbilder vorhanden.</p>}
      <ol style={{ paddingLeft: 24 }}>
        {media.images.map((image, index) => (
          <li key={image.id} style={{ marginBottom: 20 }}>
            <CompanyImage key={image.src} image={image} />
            <p>{image.alt}</p>
            <form action={action}>
              <input type="hidden" name="image_id" value={image.id} />
              <button
                className="button"
                name="intent"
                value="gallery-up"
                disabled={pending || index === 0}
              >
                Nach oben
              </button>{" "}
              <button
                className="button"
                name="intent"
                value="gallery-down"
                disabled={pending || index === media.images.length - 1}
              >
                Nach unten
              </button>{" "}
              <button
                className="button"
                name="intent"
                value="gallery-remove"
                disabled={pending}
              >
                Bild löschen
              </button>
            </form>
          </li>
        ))}
      </ol>
      <form action={action} className={styles.form}>
        <fieldset
          disabled={pending || media.images.length >= 8}
          style={{ border: 0, padding: 0 }}
        >
          <label className={styles.field}>
            Unternehmensbild auswählen
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <label className={styles.field}>
            Bildbeschreibung (optional)
            <input name="alt_text" maxLength={500} />
          </label>
          <button
            className="button button-primary"
            name="intent"
            value="gallery-upload"
          >
            {pending ? "Bitte warten …" : "Bild hochladen"}
          </button>
        </fieldset>
      </form>
      {media.images.length >= 8 && (
        <p>Die maximale Anzahl von 8 Bildern ist erreicht.</p>
      )}
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className={styles.success}>
          {state.success}
        </p>
      )}
    </section>
  );
}
