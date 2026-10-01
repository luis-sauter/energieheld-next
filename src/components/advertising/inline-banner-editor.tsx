"use client";

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adPlacements, adTargetUrl, type AdPlacementId, type ActiveAd } from "@/lib/ad-values";
import type { InlineBannerOptions, InlineBanner } from "@/lib/inline-ad-context";
import { InlineBannerContext } from "./inline-banner-context";
import { CampaignSlot } from "./campaign-view";
import styles from "./inline-banner-editor.module.css";
import { bannerSizes, type BannerSize } from "@/lib/banner-presentation";

export function InlineBannerProvider({ options, children }: { options?: InlineBannerOptions; children: ReactNode }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Partial<Record<AdPlacementId, ActiveAd | null>>>({});
  const [selected, setSelected] = useState<{ placement: AdPlacementId; banner?: InlineBanner } | null>(null);
  const [message, setMessage] = useState("");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
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
  const availability = { ...options.availability };
  for (const banner of options.banners) if (removedIds.includes(banner.id)) delete availability[banner.placement];
  for (const ad of Object.values(overrides)) if (ad?.imageUrl) availability[ad.placement] = "Belegt";
  function bannerAt(placement: AdPlacementId, campaignId?: string): InlineBanner | undefined {
    if (Object.hasOwn(overrides, placement)) {
      const updated = overrides[placement];
      return updated ? { id: updated.id, placement, target_url: updated.target_url, imageUrl: updated.imageUrl,
        shared: false, source: updated.source === "legacy" ? "legacy" : "campaign",
        editorial: options!.banners.find((item) => item.id === updated.id)?.editorial ?? updated.source !== "legacy", size: updated.banner_size } : undefined;
    }
    return options!.banners.find((item) => !removedIds.includes(item.id) && (campaignId ? item.id === campaignId : item.placement === placement));
  }
  return <InlineBannerContext.Provider value={{ overrides, bannerAt, reorder: options.reorder,
    canMove: (placement) => { const banner = bannerAt(placement); return !options.error && (!banner || banner.source === "legacy" || (banner.editorial === true && !banner.shared)); },
    reordered: () => { setOverrides({}); setRemovedIds([]); },
    hasBanner: (placement) => Boolean(bannerAt(placement)), open(placement, campaignId) {
    setMessage("");
    const banner = bannerAt(placement, campaignId);
    setSelected({ placement, banner });
  } }}>
    {message && <p className={styles.success} role="status">{message}</p>}
    {children}
    {selected && <InlineBannerDialog options={{ ...options, availability }} selected={selected} onClose={() => setSelected(null)}
      onChanged={(ad) => { setOverrides((current) => ({ ...current, [ad.placement]: ad })); router.refresh(); }}
      onRemoved={(warning) => {
        if (selected.banner) setRemovedIds((current) => [...current, selected.banner!.id]);
        setOverrides((current) => ({ ...current, [selected.placement]: null }));
        setMessage(warning || "Das Banner wurde entfernt. Der Platz ist wieder frei.");
        setSelected(null); setRevealPlacement(selected.placement); router.refresh();
      }}
      onSaved={(ad) => {
        setOverrides((current) => ({ ...current, ...(selected.banner ? { [selected.banner.placement]: null } : {}), [ad.placement]: ad }));
        setMessage(ad.suppressed ? "Gespeichert. Ohne Bild bleibt das Banner öffentlich ausgeblendet." : "Das Banner wurde gespeichert und ist an seinem Platz sichtbar.");
        setSelected(null);
        setRevealPlacement(ad.placement);
        router.refresh();
      }} />}
  </InlineBannerContext.Provider>;
}

function InlineBannerDialog({ options, selected, onClose, onSaved, onChanged, onRemoved }: {
  options: InlineBannerOptions;
  selected: { placement: AdPlacementId; banner?: InlineBanner };
  onClose: () => void;
  onSaved: (ad: ActiveAd) => void;
  onChanged: (ad: ActiveAd) => void;
  onRemoved: (warning?: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [campaignId, setCampaignId] = useState(selected.banner?.source === "legacy" ? "" : selected.banner?.id ?? "");
  const [source, setSource] = useState(selected.banner?.source);
  const [size, setSize] = useState<BannerSize>(selected.banner?.size ?? "large");
  const [placement, setPlacement] = useState(selected.placement);
  const [url, setUrl] = useState(selected.banner?.target_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(selected.banner?.imageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(options.error ?? "");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const blocked = Boolean(options.availability[placement] && placement !== selected.banner?.placement);
  const canRemove = Boolean(selected.banner?.editorial || source === "legacy" || (selected.banner?.source === "legacy" && source === "campaign"));
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
    if (!file && !preview && !selected.banner) { setError("Bitte wählen Sie ein Bannerbild."); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const form = mutationForm();
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

  function mutationForm() {
    const form = new FormData();
    form.set("campaign_id", campaignId); form.set("placement", placement);
    form.set("target_url", url.trim()); form.set("size", size);
    if (source === "legacy") { form.set("legacy_id", selected.banner!.id); form.set("original_placement", selected.placement); }
    return form;
  }
  async function remove(action: "image" | "banner") {
    if (busyRef.current || !selected.banner || selected.banner.shared || options.error) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const form = mutationForm(); form.set("placement", selected.placement); form.set("action", action);
      const result = await options.remove(form);
      if (!result.success) { setError(result.error || "Entfernen ist gerade nicht möglich."); return; }
      if (result.removed) { onRemoved(result.warning); return; }
      if (result.ad) {
        setFile(null); setPreview(""); setSource("campaign"); setCampaignId(result.ad.id);
        if (fileInput.current) fileInput.current.value = "";
        setNotice(result.warning || result.success); onChanged(result.ad);
      }
    } catch { setError("Entfernen ist gerade nicht möglich. Bitte versuchen Sie es erneut."); }
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
      {!selected.banner && <p className={styles.hint}>Das Banner erscheint ab sofort, bis Sie es entfernen.</p>}
      {selected.banner?.shared && <p role="alert">Dieses Banner wird in mehreren Bereichen verwendet. Bitte bearbeiten Sie es in der bestehenden Kampagnenverwaltung.</p>}
      <fieldset disabled={busy || selected.banner?.shared} className={styles.fields}>
        <label>{preview ? "Bild ersetzen" : "Bild hinzufügen"}<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} /></label>
        {preview && selected.banner && canRemove &&
          <button type="button" className="button" disabled={Boolean(options.error)} onClick={() => remove("image")}>Bild entfernen</button>}
        <small>JPEG, PNG oder WebP · maximal 5 MB</small>
        <label>Ziel-URL<input type="url" required maxLength={2048} value={url} placeholder="https://" onChange={(event) => setUrl(event.target.value)} /></label>
        <label>Bannergröße<select value={size} onChange={(event) => setSize(event.target.value as BannerSize)}>
          {Object.entries(bannerSizes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Bannerplatz<select value={placement} disabled={source === "legacy"} onChange={(event) => setPlacement(event.target.value as AdPlacementId)}>
          {Object.entries(adPlacements).map(([key, label]) => <option key={key} value={key}
            disabled={key !== selected.banner?.placement && Boolean(options.availability[key])}>
            {label}{options.availability[key] ? ` · ${options.availability[key]}` : " · Frei"}
          </option>)}
        </select></label>
      </fieldset>
      {blocked && <p className={styles.hint}>Dieser Platz ist bereits belegt oder angefragt. Bitte wählen Sie einen freien Bannerplatz.</p>}
      {preview && <InlineBannerContext.Provider value={null}><CampaignSlot placement={placement} preview
        ad={{ id: campaignId, placement, image_path: null, imageUrl: preview, headline: "Banner-Vorschau", body_text: null, target_url: url, banner_size: size }} /></InlineBannerContext.Provider>}
      {!preview && selected.banner && <p className={styles.hint}>Ohne Bild wird das Banner öffentlich nicht angezeigt. Sie können hier jederzeit ein Bild hinzufügen.</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className="button button-primary" disabled={busy || selected.banner?.shared || blocked || Boolean(options.error)}>{busy ? "Speichert …" : "Banner speichern"}</button>
        <button type="button" className="button" disabled={busy} onClick={onClose}>Abbrechen</button>
      </div>
      {selected.banner && !selected.banner.shared && canRemove &&
        <div className={styles.deleteSection}>
          {confirmDelete ? <>
            <p>Dieses Banner von dieser Seite und diesem Platz entfernen?</p>
            <div className={styles.actions}>
              <button type="button" className="button" disabled={busy} onClick={() => remove("banner")}>Ja, Banner löschen</button>
              <button type="button" className="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Behalten</button>
            </div>
          </> : <button type="button" className="button" disabled={busy || Boolean(options.error)} onClick={() => setConfirmDelete(true)}>Banner löschen</button>}
        </div>}
    </form>
  </dialog>;
}
