"use client";
import Link from "next/link";
import { BannerMediaPicker } from "./banner-media-picker";

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adPlacements, adTargetUrl, type AdPlacementId, type ActiveAd } from "@/lib/ad-values";
import type { InlineBannerOptions, InlineBanner } from "@/lib/inline-ad-context";
import { InlineBannerContext } from "./inline-banner-context";
import { CampaignSlot } from "./campaign-view";
import { CampaignLifecycle } from './campaign-lifecycle';
import styles from "./inline-banner-editor.module.css";
import { bannerCropRatio, bannerSizes, type BannerSize } from "@/lib/banner-presentation";
import { BannerSearchFields } from './banner-search-fields';
import { ImageCropControls } from "../admin/image-crop-controls";
import { imageCropStyle, normalizeImageCrop, type ImageCrop } from "@/lib/image-crop";
import type { BannerSearchMetadata } from '@/lib/banner-search-metadata';
import { appendBannerSearchAssignment } from '@/lib/banner-search-form';

export function InlineBannerProvider({ options, children }: { options?: InlineBannerOptions; children: ReactNode }) {
  const router = useRouter();
  const [overrides, setOverrides] = useState<Partial<Record<AdPlacementId, (ActiveAd & { metadata?: BannerSearchMetadata }) | null>>>({});
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
        crop: updated.crop, image_width: updated.image_width, image_height: updated.image_height, mobile_image: updated.mobile_image,
        shared: options!.banners.find(item => item.id === updated.id)?.shared ?? false,
        metadata: updated.metadata ?? options!.banners.find(item => item.id === updated.id)?.metadata,
        source: updated.source === "legacy" ? "legacy" : "campaign",
        editorial: options!.banners.find((item) => item.id === updated.id)?.editorial ?? updated.source !== "legacy", size: updated.banner_size } : undefined;
    }
    return options!.banners.find((item) => !removedIds.includes(item.id) && (campaignId ? item.id === campaignId : item.placement === placement));
  }
  return <InlineBannerContext.Provider value={{ overrides, bannerAt, reorder: options.reorder,
    canMove: () => !options.error,
    reordered: () => { setOverrides({}); setRemovedIds([]); },
    hasBanner: (placement) => Boolean(bannerAt(placement)), open(placement, campaignId) {
    setMessage("");
    const banner = bannerAt(placement, campaignId);
    setSelected({ placement, banner });
  } }}>
    {message && <p className={styles.success} role="status">{message}</p>}
    {children}
    {selected && <InlineBannerDialog options={{ ...options, availability }} selected={selected} onClose={() => setSelected(null)}
      onMetadataSaved={() => { setMessage('Die Suchdaten wurden gespeichert.'); setSelected(null); router.refresh(); }}
      onChanged={(ad) => { setOverrides((current) => ({ ...current, [ad.placement]: ad })); router.refresh(); }}
      onRemoved={(warning) => {
        if (selected.banner) setRemovedIds((current) => [...current, selected.banner!.id]);
        setOverrides((current) => ({ ...current, [selected.placement]: null }));
        setMessage(warning || "Das Banner wurde entfernt. Der Platz ist wieder frei.");
        setSelected(null); setRevealPlacement(selected.placement); router.refresh();
      }}
      onSaved={(ad, metadata) => {
        setOverrides((current) => ({ ...current, ...(selected.banner ? { [selected.banner.placement]: null } : {}), [ad.placement]: { ...ad, metadata } }));
        setMessage(ad.suppressed ? "Gespeichert. Ohne Bild bleibt das Banner öffentlich ausgeblendet." : "Das Banner wurde gespeichert und ist an seinem Platz sichtbar.");
        setSelected(null);
        setRevealPlacement(ad.placement);
        router.refresh();
      }} />}
  </InlineBannerContext.Provider>;
}

export function InlineBannerDialog({ options, selected, onClose, onSaved, onChanged, onRemoved, onMetadataSaved }: {
  options: InlineBannerOptions;
  selected: { placement: AdPlacementId; banner?: InlineBanner };
  onClose: () => void;
  onSaved: (ad: ActiveAd, metadata: BannerSearchMetadata) => void;
  onChanged: (ad: ActiveAd) => void;
  onRemoved: (warning?: string) => void;
  onMetadataSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [campaignId, setCampaignId] = useState(selected.banner?.source === "legacy" ? "" : selected.banner?.id ?? "");
  const [source, setSource] = useState(selected.banner?.source);
  const [size, setSize] = useState<BannerSize>(selected.banner?.size ?? "large");
  const [placement, setPlacement] = useState(selected.placement);
  const [url, setUrl] = useState(selected.banner?.target_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(selected.banner?.imageUrl ?? "");
  const [crop, setCrop] = useState(() => normalizeImageCrop(selected.banner?.crop));
  const [cropDirty, setCropDirty] = useState(false);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(selected.banner?.image_width && selected.banner.image_height ? selected.banner.image_width / selected.banner.image_height : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(options.error ?? "");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [archiveMode, setArchiveMode] = useState(false);
  const [archivedId, setArchivedId] = useState('');
  const [metadata, setMetadata] = useState<BannerSearchMetadata>(selected.banner?.metadata ?? { name: '', postal_code: '', city: '', term_keys: [] });
  const metadataOnly = Boolean(selected.banner?.source === 'campaign' && selected.banner.shared);
  const originalMetadata = selected.banner?.metadata;
  const metadataUnchanged = originalMetadata && JSON.stringify([metadata.advertiser_key,metadata.advertiser_name,metadata.advertiser_profile_id,metadata.commercial,metadata.primary_creative,metadata.destination_slugs,metadata.region]) === JSON.stringify([originalMetadata.advertiser_key,originalMetadata.advertiser_name,originalMetadata.advertiser_profile_id,originalMetadata.commercial,originalMetadata.primary_creative,originalMetadata.destination_slugs,originalMetadata.region]) && metadata.name === originalMetadata.name &&
    metadata.postal_code === originalMetadata.postal_code && metadata.city === originalMetadata.city &&
    JSON.stringify([...metadata.term_keys].sort()) === JSON.stringify([...originalMetadata.term_keys].sort());
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
    if (busyRef.current || blocked || options.error) return;
    if (archiveMode) {
      busyRef.current = true; setBusy(true); setError('');
      try {
        const form = new FormData(); form.set('archived_id', archivedId); form.set('placement', placement); form.set('size', size); form.set('confirmed', 'yes');
        const result = await options.reuse?.(form);
        if (!result?.success || !result.ad) { setError(result?.error || 'Der Banner konnte nicht eingesetzt werden.'); return; }
        onSaved(result.ad, result.metadata ?? { name: result.ad.headline, postal_code: '', city: '', term_keys: [] });
      } catch { setError('Der Banner konnte gerade nicht eingesetzt werden.'); }
      finally { busyRef.current = false; setBusy(false); }
      return;
    }
    if (!adTargetUrl(url.trim())) { setError("Bitte geben Sie eine gültige Ziel-URL mit https:// oder http:// ein."); return; }
    if (!file && !preview && !selected.banner) { setError("Bitte wählen Sie ein Bannerbild."); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const form = mutationForm();
      if (metadataOnly || (selected.banner && !file && url === selected.banner.target_url && size === (selected.banner.size ?? 'large'))) {
        if (!cropDirty || metadataOnly || !metadataUnchanged) {
          const result = await options.saveMetadata?.(form);
          if (!result?.success) { setError(result?.error ?? 'Die Suchdaten konnten nicht gespeichert werden.'); return; }
        }
        if (cropDirty && !metadataOnly) {
          if (!await persistCrop(form)) return;
          onSaved(currentPreview(), metadata);
        } else onMetadataSaved();
        return;
      }
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
      if (cropDirty) {
        setFile(null); setCampaignId(result.ad.source === "legacy" ? "" : result.ad.id);
        setSource(result.ad.source === "legacy" ? "legacy" : "campaign");
        form.set("campaign_id", result.ad.source === "legacy" ? "" : result.ad.id);
        if (result.ad.source !== "legacy") form.delete("legacy_id");
        if (!await persistCrop(form)) return;
      }
      onSaved({ ...result.ad, crop: cropDirty ? crop : !file ? selected.banner?.crop : undefined }, metadata);
    } catch { setError("Speichern ist gerade nicht möglich. Bitte versuchen Sie es erneut."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function currentPreview(): ActiveAd {
    return { id: campaignId || selected.banner?.id || "", placement, image_path: null, imageUrl: preview,
      headline: metadata.name, body_text: null, target_url: url, banner_size: size,
      image_width: selected.banner?.image_width, image_height: selected.banner?.image_height, mobile_image: selected.banner?.mobile_image,
      source: source === "legacy" ? "legacy" : "campaign", crop: cropDirty ? crop : selected.banner?.crop };
  }
  async function persistCrop(form: FormData) {
    form.set("focus_x", String(crop.focus_x)); form.set("focus_y", String(crop.focus_y)); form.set("zoom", String(crop.zoom));
    const result = await options.saveCrop?.(form);
    if (!result?.success) { setError(result?.error ?? "Der Bildausschnitt konnte nicht gespeichert werden. Bitte versuchen Sie es erneut."); return false; }
    return true;
  }
  function changeCrop(next: ImageCrop | ((old: ImageCrop) => ImageCrop)) {
    setCropDirty(true); setCrop(next);
  }
  function mutationForm() {
    const form = new FormData();
    form.set("campaign_id", campaignId); form.set("placement", placement);
    form.set("target_url", url.trim()); form.set("size", size);
    form.set('headline', metadata.name); form.set('banner_postal_code', metadata.postal_code); form.set('banner_city', metadata.city);
    metadata.term_keys.forEach(key => form.append('banner_terms', key)); appendBannerSearchAssignment(form,metadata);
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
        setFile(null); setPreview(""); setCrop(normalizeImageCrop(null)); setCropDirty(false); setSource("campaign"); setCampaignId(result.ad.id);

        setNotice(result.warning || result.success); onChanged(result.ad);
      }
    } catch { setError("Entfernen ist gerade nicht möglich. Bitte versuchen Sie es erneut."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function archive(form: FormData) {
    if (form.get('confirmed') !== 'yes' || !options.archive) return { error: 'Bitte bestätigen Sie die Archivierung.' };
    const input = mutationForm(); input.set('confirmed', 'yes');
    if (source === 'legacy') {
      // Import only this verified visible creative through the existing private upload flow.
      // The immutable/shared legacy asset itself is never deleted or changed.
      try {
        const response = await fetch(selected.banner!.imageUrl!);
        if (!response.ok) return { error: 'Das Bestandsbild konnte nicht geladen werden.' };
        const blob = await response.blob();
        input.set('file_type', blob.type); input.set('file_size', String(blob.size));
        const prepared = await options.prepare(input);
        if (!prepared.campaignId || !prepared.uploadPath) return { error: prepared.error || 'Das Archivbild konnte nicht vorbereitet werden.' };
        input.set('campaign_id', prepared.campaignId); setCampaignId(prepared.campaignId);
        const uploaded = await createClient().storage.from('ad-media').upload(prepared.uploadPath, blob, { contentType: blob.type, upsert: false });
        if (uploaded.error) return { error: 'Das Archivbild konnte nicht gespeichert werden.' };
        input.set('uploaded_path', prepared.uploadPath);
        const saved = await options.save(input);
        if (!saved.success || !saved.ad) return { error: saved.error || 'Das Bestandsbanner konnte nicht übernommen werden.' };
        setSource('campaign'); onChanged(saved.ad); input.delete('legacy_id');
        if (selected.banner?.crop && options.saveCrop) {
          for (const [key,value] of Object.entries(selected.banner.crop)) input.set(key,String(value));
          const cropped = await options.saveCrop(input);
          if (!cropped.success) return { error: cropped.error || 'Der Bildausschnitt konnte nicht übernommen werden.' };
        }
      } catch { return { error: 'Das Bestandsbanner konnte gerade nicht archiviert werden.' }; }
    }
    return options.archive(input);
  }

  function chooseFile(next: File | null) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size <= 0 || next.size > 5242880) {
      setError("Bitte wählen Sie JPEG, PNG oder WebP mit maximal 5 MB."); return;
    }
    setCrop(normalizeImageCrop(null)); setCropDirty(false); setNaturalRatio(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setError("");
  }

  return <><dialog ref={dialog} className={styles.dialog} aria-labelledby="inline-banner-title"
    onCancel={(event) => { event.preventDefault(); if (!busyRef.current) onClose(); }}>
    <form onSubmit={save} className={styles.form}>
      <h2 id="inline-banner-title">{selected.banner ? "Banner bearbeiten" : "Banner hinzufügen"}</h2>
      <p>{options.label}</p>
      {!selected.banner && <fieldset disabled={busy} className={styles.fields}><legend>Banner auswählen</legend>
        <label className={styles.choice}><input type="radio" name="banner_origin" checked={!archiveMode} onChange={() => setArchiveMode(false)} /> Neues Banner</label>
        <label className={styles.choice}><input type="radio" name="banner_origin" checked={archiveMode} onChange={() => setArchiveMode(true)} /> Banner aus Archiv</label>
      </fieldset>}
      {archiveMode ? <>
        <p>Das archivierte Original bleibt erhalten. Eine unabhängige Kopie wird auf dieser Seite eingesetzt.</p>
        <fieldset disabled={busy} className={styles.fields}>
          <label>Archivierter Banner<select value={archivedId} required onChange={event => setArchivedId(event.target.value)}>
            <option value="">Bitte wählen</option>{(options.archived ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          {!(options.archived?.length) && <p>Es sind noch keine archivierten Banner vorhanden.</p>}
          <label>Bannergröße<select value={size} onChange={event => setSize(event.target.value as BannerSize)}>{Object.entries(bannerSizes).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <p>{adPlacements[placement]}</p>

        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className={styles.actions}><button type="submit" className="button button-primary" disabled={busy || blocked || !archivedId || Boolean(options.error)}>{busy ? 'Setzt ein …' : 'Banner einsetzen'}</button><button type="button" className="button" disabled={busy} onClick={onClose}>Abbrechen</button></div>
      </> : <>
      {!selected.banner && <p className={styles.hint}>Das Banner erscheint ab sofort, bis Sie es entfernen.</p>}
      <p className={styles.hint}>Name, PLZ, Ort und Kategorien gelten für dieses Banner in allen Bereichen und machen es in der Suche auffindbar.</p>
      <fieldset disabled={busy} className={styles.fields}>
        <BannerSearchFields value={metadata} terms={options.terms ?? []} advertisers={options.advertisers} onChange={setMetadata} />
      </fieldset>
      {metadataOnly && <p className={styles.hint}>Bei gebuchten oder geteilten Bannern ändern Sie hier nur die Suchdaten. Bild, Ziel-URL und Buchung bleiben unverändert. <Link href={`/admin/werbung/${selected.banner!.id}`}>Banner in der bestehenden Verwaltung bearbeiten</Link></p>}
      <fieldset disabled={busy || metadataOnly} className={styles.fields}>
        <button type="button" className="button" onClick={() => setLibraryOpen(true)}>{preview ? "Bild ersetzen" : "Bild hinzufügen"}</button>
        {file && <p role="status">Bild ausgewählt. Erst „Banner speichern“ übernimmt die Änderung.</p>}
        {preview && selected.banner && canRemove &&
          <button type="button" className="button" disabled={Boolean(options.error)} onClick={() => remove("image")}>Bild entfernen</button>}
        <small>JPEG, PNG oder WebP · maximal 5 MB</small>
        {preview && !metadataOnly && <>
          {/* Determine the actual Premium ratio, including a newly selected local image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" hidden onLoad={event => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) setNaturalRatio(image.naturalWidth / image.naturalHeight);
          }} />
          {(placement !== "top_banner" || naturalRatio) && <ImageCropControls crop={crop} setCrop={changeCrop}
            ratio={bannerCropRatio(size, placement, naturalRatio ?? 1)} alt={metadata.name || "Banner"} disabled={busy || Boolean(options.error)}
            renderImage={value => (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={metadata.name || "Banner"} draggable={false}
                style={{ ...imageCropStyle(value), display: "block", width: "100%", height: "100%", position: "absolute", inset: 0 }} />
            )} />}
          {!cropDirty && !selected.banner?.crop && <small>Der Ausschnitt wird erst gespeichert, wenn Sie ihn bearbeiten. Bis dahin bleibt das vollständige Bild sichtbar.</small>}
        </>}
        <label>Ziel-URL<input type="url" required maxLength={2048} value={url} placeholder="https://" onChange={(event) => setUrl(event.target.value)} /></label>
        <label>Bannergröße<select value={size} onChange={(event) => setSize(event.target.value as BannerSize)}>
          {Object.entries(bannerSizes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Bannerplatz<select value={placement} disabled={Boolean(selected.banner)} onChange={(event) => setPlacement(event.target.value as AdPlacementId)}>
          {Object.entries(adPlacements).map(([key, label]) => <option key={key} value={key}
            disabled={key !== selected.banner?.placement && Boolean(options.availability[key])}>
            {label}{options.availability[key] ? ` · ${options.availability[key]}` : " · Frei"}
          </option>)}
        </select></label>
      </fieldset>
      {blocked && <p className={styles.hint}>Dieser Platz ist bereits belegt oder angefragt. Bitte wählen Sie einen freien Bannerplatz.</p>}
      {preview && <InlineBannerContext.Provider value={null}><CampaignSlot placement={placement} preview
        ad={{ ...currentPreview(), crop: cropDirty ? crop : !file ? selected.banner?.crop : undefined }} /></InlineBannerContext.Provider>}
      {!preview && selected.banner && <p className={styles.hint}>Ohne Bild wird das Banner öffentlich nicht angezeigt. Sie können hier jederzeit ein Bild hinzufügen.</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="submit" className="button button-primary" disabled={busy || blocked || Boolean(options.error)}>{busy ? "Speichert …" : "Banner speichern"}</button>
        <button type="button" className="button" disabled={busy} onClick={onClose}>Abbrechen</button>
      </div>
      </>}
    </form>
      {selected.banner &&
        <div className={styles.deleteSection}>
          {(source === 'legacy' || campaignId) ? <CampaignLifecycle id={campaignId || selected.banner.id} archived={false}
            disabled={busy || Boolean(options.error)} onBusyChange={value => { busyRef.current = value; setBusy(value); }} onArchived={onRemoved} onArchive={archive}>
            {!selected.banner.shared && canRemove && !confirmDelete && <button type="button" className="button" disabled={busy || Boolean(options.error)} onClick={() => setConfirmDelete(true)}>Banner löschen</button>}
          </CampaignLifecycle> : null}
          {!selected.banner.shared && canRemove && (confirmDelete ? <>
            <p>Dieses Banner von dieser Seite und diesem Platz entfernen?</p>
            <div className={styles.actions}>
              <button type="button" className="button" disabled={busy} onClick={() => remove("banner")}>Ja, Banner löschen</button>
              <button type="button" className="button" disabled={busy} onClick={() => setConfirmDelete(false)}>Behalten</button>
            </div>
          </> : null)}
        </div>}
  </dialog>{libraryOpen && <BannerMediaPicker profileId={selected.banner?.profileId} profileName={selected.banner?.profileName} onSelected={chooseFile} onClose={() => setLibraryOpen(false)} />}</>;
}
