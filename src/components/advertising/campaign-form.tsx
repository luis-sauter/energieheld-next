"use client";
import { useActionState, useEffect, useState } from "react";
import { energieheld } from "@/config/energieheld";
import {
  adPlacements,
  adScopes,
  type AdCampaign,
  type AdPlacementId,
} from "@/lib/ad-values";
import {
  saveCampaign,
  prepareCampaignImage,
} from "@/app/(energieheld)/firma/werbung/actions";
import { createClient } from "@/lib/supabase/client";
import type { AdFormState } from "@/lib/ad-values";
import { reviewCampaign } from "@/app/(energieheld)/admin/werbung/actions";
import { CampaignSlot } from "./campaign-view";
import styles from "./advertising.module.css";
export function CampaignForm({ campaign }: { campaign: AdCampaign }) {
  const [state, action, busy] = useActionState<AdFormState, FormData>(
    async (_previous, form) => {
      const file = form.get("image");
      // Keep large multipart bodies off Netlify; finalize by validating stored bytes server-side.
      form.delete("image");
      if (!(file instanceof File) || !file.name) return saveCampaign({}, form);
      const storage = createClient().storage.from("ad-media");
      let path: string | undefined;
      try {
        const prepare = new FormData();
        prepare.set("campaign_id", campaign.id);
        prepare.set("file_type", file.type);
        prepare.set("file_size", String(file.size));
        const ready = await prepareCampaignImage(prepare);
        if (!ready.uploadPath) return ready;
        path = ready.uploadPath;
        const result = await storage.upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (result.error) throw Error("upload failed");
        form.set("uploaded_path", path);
        const saved = await saveCampaign({}, form);
        if (saved.error) await storage.remove([path]);
        return saved;
      } catch {
        if (path) await storage.remove([path]).catch(() => undefined);
        return {
          error:
            "Das Bild konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
        };
      }
    },
    {},
  );
  const [values, setValues] = useState(campaign),
    [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  const set = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="campaign_id" value={campaign.id} />
      <label>
        Interner Kampagnenname
        <input
          name="internal_name"
          required
          maxLength={120}
          value={values.internal_name}
          onChange={(e) => set("internal_name", e.target.value)}
        />
      </label>
      <fieldset>
        <legend>Wo soll Ihre Anzeige erscheinen?</legend>
        <div className={styles.placements}>
          {Object.entries(adPlacements).map(([id, label]) => (
            <label className={styles.placement} key={id}>
              <input
                type="radio"
                name="placement"
                value={id}
                checked={values.placement === id}
                onChange={() => set("placement", id)}
              />
              <span className={styles.map} aria-hidden="true">
                <i className={id === "top_banner" ? styles.selected : ""} />
                <i className={styles.content} />
                {["sidebar_top", "sidebar_middle", "sidebar_bottom"].map(
                  (slot) => (
                    <i
                      key={slot}
                      className={id === slot ? styles.selected : ""}
                    />
                  ),
                )}
              </span>
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className={styles.grid}>
        <label>
          Ausspielungsbereich
          <select
            name="scope_type"
            value={values.scope_type}
            onChange={(e) => set("scope_type", e.target.value)}
          >
            {Object.entries(adScopes).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {values.scope_type === "trade" && (
          <label>
            Gewerk
            <select
              name="category_id"
              required
              value={values.category_id ?? ""}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">Bitte wählen</option>
              {energieheld.categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={styles.grid}>
        {(
          [
            ["requested_start_date", "Gewünschter Start"],
            ["requested_end_date", "Gewünschtes Ende"],
          ] as const
        ).map(([field, label]) => (
          <label key={field}>
            {label}
            <input
              type="date"
              name={field}
              required
              value={values[field]}
              onChange={(e) => set(field, e.target.value)}
            />
          </label>
        ))}
      </div>
      <label>
        Anzeigenbild (JPEG, PNG oder WebP, maximal 5 MB)
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setImageUrl(file ? URL.createObjectURL(file) : undefined);
          }}
        />
      </label>
      <label>
        Überschrift
        <input
          name="headline"
          required
          maxLength={100}
          value={values.headline}
          onChange={(e) => set("headline", e.target.value)}
        />
      </label>
      <label>
        Kurzer Text (optional)
        <textarea
          name="body_text"
          maxLength={400}
          rows={3}
          value={values.body_text ?? ""}
          onChange={(e) => set("body_text", e.target.value)}
        />
      </label>
      <label>
        Ziel-URL
        <input
          type="url"
          name="target_url"
          required
          maxLength={2048}
          placeholder="https://www.ihre-firma.de"
          value={values.target_url}
          onChange={(e) => set("target_url", e.target.value)}
        />
      </label>
      <section>
        <h2>Anzeigenvorschau</h2>
        <CampaignSlot
          placement={values.placement as AdPlacementId}
          ad={{ ...values, imageUrl: imageUrl ?? campaign.imageUrl }}
          preview
        />
      </section>
      <p>
        Mit dem Einreichen wird die Kampagne zur Prüfung gesendet. Sie wird erst
        nach Freigabe im bestätigten Zeitraum angezeigt.
      </p>
      <div className={styles.actions}>
        <button className="button" name="intent" value="save" disabled={busy}>
          Entwurf speichern
        </button>
        <button
          className="button button-primary"
          name="intent"
          value="submit"
          disabled={busy}
        >
          Zur Prüfung einreichen
        </button>
      </div>
      {busy && <p role="status">Wird gespeichert …</p>}
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
    </form>
  );
}
export function AdminCampaignForm({ campaign: c }: { campaign: AdCampaign }) {
  const [state, action, busy] = useActionState(reviewCampaign, {});
  return (
    <form action={action} className={styles.form}>
      <input name="campaign_id" type="hidden" value={c.id} />
      {c.status === "pending" && (
        <div className={styles.grid}>
          <label>
            Bestätigter Start
            <input
              type="date"
              name="approved_start_date"
              defaultValue={c.requested_start_date}
            />
          </label>
          <label>
            Bestätigtes Ende
            <input
              type="date"
              name="approved_end_date"
              defaultValue={c.requested_end_date}
            />
          </label>
        </div>
      )}
      <label>
        Hinweis für die Firma (optional)
        <textarea
          name="admin_note"
          maxLength={2000}
          rows={3}
          defaultValue={c.admin_note ?? ""}
        />
      </label>
      <div className={styles.actions}>
        {(c.status === "pending"
          ? [
              ["approve", "Genehmigen"],
              ["reject", "Ablehnen"],
            ]
          : c.status === "approved"
            ? [["pause", "Kampagne pausieren"]]
            : c.status === "paused"
              ? [["resume", "Wieder freigeben"]]
              : []
        ).map(([value, label]) => (
          <button
            key={value}
            className="button"
            name="decision"
            value={value}
            disabled={busy}
          >
            {label}
          </button>
        ))}
      </div>
      {!["pending", "approved", "paused"].includes(c.status) && (
        <p>Für diesen Status ist keine Freigabeaktion verfügbar.</p>
      )}
      {busy && <p role="status">Wird geprüft …</p>}
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
    </form>
  );
}
