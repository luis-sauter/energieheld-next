"use client";
import { useActionState, useEffect, useState } from "react";
import {
  adPlacements,
  type AdCampaign,
  type AdPlacementId,
  type AdTarget,
} from "@/lib/ad-values";
import {
  saveCampaign,
  prepareCampaignImage,
  campaignAvailability,
} from "@/app/(energieheld)/firma/werbung/actions";
import { createClient } from "@/lib/supabase/client";
import type { AdFormState } from "@/lib/ad-values";
import { reviewCampaign, saveAdminCampaign, prepareAdminCampaignImage, adminCampaignAvailability } from "@/app/(energieheld)/admin/werbung/actions";
import { CampaignSlot } from "./campaign-view";
import styles from "./advertising.module.css";
export function CampaignForm({
  campaign,
  categoryIds,
  admin = false,
}: {
  campaign: AdCampaign;
  categoryIds: string[];
  admin?: boolean;
}) {
  const [state, action, busy] = useActionState<AdFormState, FormData>(
    async (_previous, form) => {
      const file = form.get("image");
      // Keep large multipart bodies off Netlify; finalize by validating stored bytes server-side.
      form.delete("image");
      if (!(file instanceof File) || !file.name) return admin ? saveAdminCampaign({}, form) : saveCampaign({}, form);
      const storage = createClient().storage.from("ad-media");
      let path: string | undefined;
      try {
        const prepare = new FormData();
        prepare.set("campaign_id", campaign.id);
        prepare.set("file_type", file.type);
        prepare.set("file_size", String(file.size));
        const ready = await (admin ? prepareAdminCampaignImage(prepare) : prepareCampaignImage(prepare));
        if (!ready.uploadPath) return ready;
        path = ready.uploadPath;
        const result = await storage.upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (result.error) throw Error("upload failed");
        form.set("uploaded_path", path);
        const saved = await (admin ? saveAdminCampaign({}, form) : saveCampaign({}, form));
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
  const [values, setValues] = useState(() => admin && ["approved", "paused"].includes(campaign.status)
    ? { ...campaign, requested_start_date: campaign.approved_start_date ?? campaign.requested_start_date,
        requested_end_date: campaign.approved_end_date ?? campaign.requested_end_date }
    : campaign),
    [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [availabilityResult, setAvailabilityResult] = useState<{
    key: string; slots: Record<string, "Belegt" | "Angefragt">; error: string;
  }>({ key: "", slots: {}, error: "" });
  const availabilityKey = `${values.requested_start_date}|${values.requested_end_date}|${campaign.id}|${admin}`;
  const availabilityLoading = availabilityResult.key !== availabilityKey;
  const availability = availabilityLoading ? {} : availabilityResult.slots;
  const availabilityError = availabilityLoading ? "" : availabilityResult.error;
  const hasBookedSelection = values.targets.some((target) =>
    availability[`${target.target_type}|${target.placement ?? campaign.placement}`] === "Belegt");
  useEffect(() => {
    if (!values.requested_start_date || !values.requested_end_date) return;
    let current = true;
    (admin ? adminCampaignAvailability : campaignAvailability)(values.requested_start_date, values.requested_end_date, campaign.id).then((result) => {
      if (!current) return;
      setAvailabilityResult({ key: availabilityKey, slots: result.slots ?? {}, error: result.error ?? "" });
    }).catch(() => {
      if (current) setAvailabilityResult({ key: availabilityKey, slots: {}, error: "Die Verfügbarkeit konnte nicht geprüft werden." });
    });
    return () => { current = false; };
  }, [values.requested_start_date, values.requested_end_date, campaign.id, admin, availabilityKey]);
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  const set = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));
  const setTarget = (target: AdTarget, checked: boolean) =>
    setValues((current) => {
      const remaining = current.targets.filter(
        (item) =>
          item.target_type !== target.target_type ||
          item.category_id !== target.category_id ||
          (item.placement ?? campaign.placement) !== target.placement,
      );
      return {
        ...current,
        targets: checked ? [...remaining, target] : remaining,
      };
    });
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
      <input type="hidden" name="placement" value={values.targets[0]?.placement ?? campaign.placement} />
      <fieldset>
        <legend>Wo möchten Sie werben?</legend>
        {([
          { id: "homepage", name: "Startseite" },
          { id: "experts_directory", name: "Unterkünfte A–Z" },
        ] as const).map((scope) => (
          <section key={scope.id} className={styles.scopeGroup}>
            <h3>{scope.name}</h3>
            <div className={styles.placements}>
              {Object.entries(adPlacements).map(([slot, label]) => {
                const target: AdTarget = { target_type: scope.id, category_id: null, placement: slot as AdPlacementId };
                const key = `${scope.id}|${slot}`;
                const checked = values.targets.some((t) => t.target_type === scope.id && (t.placement ?? campaign.placement) === slot);
                return <label className={styles.placement} key={key}>
                  <input type="checkbox" name="targets" value={key} checked={checked}
                    disabled={availabilityLoading || !!availabilityError || (availability[key] === "Belegt" && !checked)}
                    onChange={(event) => setTarget(target, event.target.checked)} />
                  <span>{label}</span>
                  <small>{availabilityLoading ? "Wird geprüft …" : availabilityError ? "Derzeit nicht prüfbar" : availability[key] ?? "Verfügbar"}</small>
                </label>;
              })}
            </div>
          </section>
        ))}
        {availabilityError && <p role="alert">{availabilityError}</p>}
        {hasBookedSelection &&
          <p role="alert">Ein ausgewählter Platz ist im gewünschten Zeitraum belegt. Bitte ändern Sie die Auswahl.</p>}
        {admin && values.targets.filter((target) => target.target_type === "trade").map((target) => (
          <input key={`${target.category_id}|${target.placement}`} type="hidden" name="targets"
            value={`trade:${target.category_id}|${target.placement ?? campaign.placement}`} />
        ))}
        {campaign.targets.some(
          (t) =>
            t.target_type === "trade" && !categoryIds.includes(t.category_id!),
        ) && (
          <p role="status">
            Bisherige Zielgewerke ohne aktuelle Firmenzuordnung können nicht
            erneut gespeichert werden. Wählen Sie die gewünschten verfügbaren
            Zielseiten.
          </p>
        )}
        <p className="small muted">Jeder Bannerplatz wird nur für die angezeigte Seite ausgewählt. Belegte Plätze können nicht neu gewählt werden.</p>
      </fieldset>
      <div className={styles.grid}>
        {(
          [
            ["requested_start_date", admin && ["approved", "paused"].includes(campaign.status) ? "Ausspielung ab" : "Gewünschter Start"],
            ["requested_end_date", admin && ["approved", "paused"].includes(campaign.status) ? "Ausspielung bis" : "Gewünschtes Ende"],
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
      <div className={styles.grid}>
        <label>Ansprechpartner<input name="contact_name" maxLength={120} value={values.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></label>
        <label>Telefonnummer<input name="contact_phone" type="tel" maxLength={60} value={values.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></label>
        <label>E-Mail-Adresse<input name="contact_email" type="email" maxLength={254} value={values.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></label>
      </div>
      <label>
        Anzeigenbild, falls vorhanden (JPEG, PNG oder WebP, maximal 5 MB)
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
          placement={(values.targets[0]?.placement ?? values.placement) as AdPlacementId}
          ad={{ ...values, imageUrl: imageUrl ?? campaign.imageUrl }}
          preview
        />
      </section>
      <p>
        {admin ? "Redaktionelle Änderungen an einer freigegebenen Kampagne werden sofort wirksam. Entwürfe werden erst nach Freigabe ausgespielt." : "Mit dem Einreichen wird die Kampagne zur Prüfung gesendet. Sie wird erst nach Freigabe im bestätigten Zeitraum angezeigt."}
      </p>
      <div className={styles.actions}>
        <button className="button" name="intent" value="save" disabled={busy || (admin && campaign.status === "approved" && (availabilityLoading || !!availabilityError || hasBookedSelection))}>
          {admin ? "Banner speichern" : "Entwurf speichern"}
        </button>
        {(!admin || ["draft", "rejected"].includes(campaign.status)) && <button
          className="button button-primary"
          name="intent"
          value="submit"
          disabled={busy || availabilityLoading || !!availabilityError || hasBookedSelection}
        >
          {admin ? "Zur Freigabe vormerken" : "Zur Prüfung einreichen"}
        </button>}
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
