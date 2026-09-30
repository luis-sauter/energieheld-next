"use client";

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adPlacements, adTargetUrl, type AdPlacementId, type ActiveAd } from "@/lib/ad-values";
import type { InlineBannerOptions, InlineBanner } from "@/lib/inline-ad-context";
import { InlineBannerContext } from "./inline-banner-context";
import { CampaignSlot } from "./campaign-view";
import styles from "./inline-banner-editor.module.css";

export function InlineBannerProvider({ options, children }: { options?: InlineBannerOptions; children: ReactNode }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Partial<Record<AdPlacementId, ActiveAd | null>>>({});
  const [selected, setSelected] = useState<{ placement: AdPlacementId; banner?: InlineBanner } | null>(null);
  const [message, setMessage] = useState("");
  const [revealPlacement, setRevealPlacement] = useState<AdPlacementId | null>(null);
  useEffect(() => {
    if (selected || !revealPlacement) return;
    const frame = requestAnimationFrame(() => {
      const slot = document.querySelector<HTMLElement>(`[data-placement="${revealPlacement}"]`);
      slot?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      slot?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, revealPlacement]);
  if (!options) return children;
  return <InlineBannerContext.Provider value={{ overrides, open(placement, campaignId) {
    setMessage("");
    const updated = overrides[placement];
    const banner = updated ? { id: updated.id, placement, target_url: updated.target_url, imageUrl: updated.imageUrl, shared: false }
      : options.banners.find((item) => campaignId ? item.id === campaignId : item.placement === placement);
    setSelected({ placement, banner });
  } }}>
    {message && <p className={styles.success} role="status">{message}</p>}
    {children}
    {selected && <InlineBannerDialog options={options} selected={selected} onClose={() => setSelected(null)}
      onSaved={(ad) => {
        setOverrides((current) => ({ ...current, ...(selected.banner ? { [selected.banner.placement]: null } : {}), [ad.placement]: ad }));
        setMessage("Das Banner wurde gespeichert und ist an seinem Platz sichtbar.");
        setSelected(null);
        setRevealPlacement(ad.placement);
        router.refresh();
      }} />}
  </InlineBannerContext.Provider>;
}

function InlineBannerDialog({ options, selected, onClose, onSaved }: {
  options: InlineBannerOptions;
  selected: { placement: AdPlacementId; banner?: InlineBanner };
  onClose: () => void;
  onSaved: (ad: ActiveAd) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [campaignId, setCampaignId] = useState(selected.banner?.id ?? "");
  const [placement, setPlacement] = useState(selected.placement);
  const [url, setUrl] = useState(selected.banner?.target_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(selected.banner?.imageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(options.error ?? "");
  const blocked = Boolean(options.availability[placement] && placement !== selected.banner?.placement);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => previous?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!preview.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || selected.banner?.shared || blocked || options.error) return;
    if (!adTargetUrl(url.trim())) { setError("Bitte geben Sie eine gültige Ziel-URL mit https:// oder http:// ein."); return; }
    if (!file && !selected.banner?.imageUrl) { setError("Bitte wählen Sie ein Bannerbild."); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("campaign_id", campaignId);
      form.set("placement", placement);
      form.set("target_url", url.trim());
      if (file) {
        form.set("file_type", file.type);
        form.set("file_size", String(file.size));
        const prepared = await options.prepare(form);
        if (prepared.campaignId) { setCampaignId(prepared.campaignId); form.set("campaign_id", prepared.campaignId); }
        if (!prepared.uploadPath) { setError(prepared.error ?? "Der Upload konnte nicht vorbereitet werden."); return; }
        const uploaded = await createClient().storage.from("ad-media").upload(prepared.uploadPath, file, { contentType: file.type, upsert: false });
        if (uploaded.error) { setError("Das Bannerbild konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut."); return; }
        form.set("uploaded_path", prepared.uploadPath);
      }
      const result = await options.save(form);
      if (!result.success || !result.ad) { setError(result.error ?? "Das Banner konnte nicht gespeichert werden."); return; }
      onSaved(result.ad);
    } catch { setError("Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function chooseFile(next: File | null) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size <= 0 || next.size > 5242880) {
      setError("Bitte wählen Sie JPEG, PNG oder WebP mit maximal 5 MB."); return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setError("");
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="inline-banner-title"
    onCancel={(event) => { event.preventDefault(); if (!busyRef.current) onClose(); }}>
    <form onSubmit={save} className={styles.form}>
      <h2 id="inline-banner-title">{selected.banner ? "Banner bearbeiten" : "Banner hinzufügen"}</h2>
      <p>{options.label}</p>
      {!selected.banner && <p className={styles.hint}>Das Banner erscheint ab sofort, bis es geändert oder in der Kampagnenverwaltung pausiert wird.</p>}
      {selected.banner?.shared && <p role="alert">Dieses Banner wird in mehreren Bereichen verwendet. Bitte bearbeiten Sie es in der bestehenden Kampagnenverwaltung.</p>}
      <fieldset disabled={busy || selected.banner?.shared} className={styles.fields}>
        <label>Bannerbild<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} /></label>
        <small>JPEG, PNG oder WebP · maximal 5 MB</small>
        <label>Ziel-URL<input type="url" required maxLength={2048} value={url} placeholder="https://" onChange={(event) => setUrl(event.target.value)} /></label>
        <label>Bannerplatz<select value={placement} onChange={(event) => setPlacement(event.target.value as AdPlacementId)}>
          {Object.entries(adPlacements).map(([key, label]) => <option key={key} value={key}
            disabled={key !== selected.banner?.placement && Boolean(options.availability[key])}>
            {label}{options.availability[key] ? ` · ${options.availability[key]}` : " · Frei"}
          </option>)}
        </select></label>
      </fieldset>
      {blocked && <p className={styles.hint}>Dieser Platz ist bereits belegt oder angefragt. Bitte wählen Sie einen freien Bannerplatz.</p>}
      {preview && <InlineBannerContext.Provider value={null}><CampaignSlot placement={placement} preview
        ad={{ id: campaignId, placement, image_path: null, imageUrl: preview, headline: "Banner-Vorschau", body_text: null, target_url: url }} /></InlineBannerContext.Provider>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className="button button-primary" disabled={busy || selected.banner?.shared || blocked || Boolean(options.error)}>{busy ? "Speichert …" : "Banner speichern"}</button>
        <button type="button" className="button" disabled={busy} onClick={onClose}>Abbrechen</button>
      </div>
    </form>
  </dialog>;
}
