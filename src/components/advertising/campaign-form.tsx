"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  adPlacements,
  adTargetAvailabilityKey,
  adTargetFormValue,
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
import { portalAdAreaLabel, portalAdSections, portalAdSection, requestAdScopes, type RequestAdScope } from "@/lib/ad-target-areas";
import styles from "./advertising.module.css";
import { BannerSearchFields } from './banner-search-fields';
import type { BannerSearchMetadata, BannerSearchTerm } from '@/lib/banner-search-metadata';
export function removeRequestScope(targets: AdTarget[], scope: RequestAdScope) {
  return targets.filter((target) => target.target_type === "portal_area"
    ? portalAdSection(target.target_key ?? "") !== scope
    : target.target_type !== scope);
}
export function removePortalArea(targets: AdTarget[], key: string) {
  return targets.filter((target) => target.target_type !== "portal_area" || target.target_key !== key);
}
export function changePortalArea(targets: AdTarget[], oldKey: string, newKey: string) {
  return targets.map((target) => target.target_type === "portal_area" && target.target_key === oldKey
    ? { ...target, target_key: newKey } : target);
}
export function addRequestScope(scopes: RequestAdScope[], scope: RequestAdScope) {
  return scopes.includes(scope) ? scopes : [...scopes, scope];
}
export function availableRequestScopes(scopes: RequestAdScope[], areas: string[]) {
  return requestAdScopes.filter((scope) => {
    const section = portalAdSections.find((item) => item.id === scope.id);
    return section ? section.areas.some((area) => !areas.includes(area.key)) : !scopes.includes(scope.id);
  });
}
export function addPortalArea(areas: string[], key: string) {
  return !portalAdSection(key) || areas.includes(key) ? areas : [...areas, key];
}
export function revealAddedPortalArea(card: HTMLElement, reducedMotion: boolean) {
  card.querySelector<HTMLSelectElement>("select")?.focus({ preventScroll: true });
  card.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
}
export function requestScopeIds(targets: AdTarget[], pristine = false): RequestAdScope[] {
  return pristine ? [] : requestAdScopes.filter((scope) => targets.some((target) => target.target_type === "portal_area"
    ? portalAdSection(target.target_key ?? "") === scope.id : target.target_type === scope.id)).map((scope) => scope.id);
}
export function slotAvailabilityText(status: "Belegt" | "Angefragt" | undefined, checked: boolean, loading: boolean, error: string) {
  const label = loading ? "Wird geprüft …" : error ? "Derzeit nicht prüfbar" : status ?? "Verfügbar";
  return checked ? `Ausgewählt · ${label}` : label;
}
export function CampaignForm({
  campaign,
  categoryIds,
  admin = false,
  bannerMetadata,
  bannerTerms = [],
}: {
  campaign: AdCampaign;
  categoryIds: string[];
  admin?: boolean;
  bannerMetadata?: BannerSearchMetadata;
  bannerTerms?: BannerSearchTerm[];
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
  const pristine = !admin && campaign.status === "draft" && !campaign.internal_name && !campaign.headline && !campaign.target_url;
  const [metadata, setMetadata] = useState(bannerMetadata ?? { name: campaign.headline, postal_code: '', city: '', term_keys: [] });
  const [values, setValues] = useState(() => {
    if (campaign.status === 'draft' && !campaign.targets.length)
      return { ...campaign, requested_start_date: '', requested_end_date: '' };
    if (admin && ["approved", "paused"].includes(campaign.status))
      return { ...campaign, requested_start_date: campaign.approved_start_date ?? campaign.requested_start_date,
        requested_end_date: campaign.approved_end_date ?? campaign.requested_end_date };
    return pristine ? { ...campaign, targets: [] } : campaign;
  });
  const [shownScopes, setShownScopes] = useState<RequestAdScope[]>(() => requestScopeIds(campaign.targets, pristine));
  const [shownAreas, setShownAreas] = useState<string[]>(() => {
    const areas = campaign.targets.filter((target) => target.target_type === "portal_area" && portalAdSection(target.target_key ?? ""))
      .map((target) => target.target_key!);
    return areas.filter((key, index) => areas.indexOf(key) === index);
  });
  const [scopePickerOpen, setScopePickerOpen] = useState(false);
  const scopeToFocus = useRef<RequestAdScope | null>(null);
  const areaPickers = useRef<Partial<Record<RequestAdScope, HTMLSelectElement | null>>>({});
  const areaToFocus = useRef<string | null>(null);
  const areaCards = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (scopeToFocus.current) areaPickers.current[scopeToFocus.current]?.focus();
    scopeToFocus.current = null;
  }, [scopePickerOpen, shownScopes]);
  useEffect(() => {
    const card = areaToFocus.current ? areaCards.current[areaToFocus.current] : null;
    areaToFocus.current = null;
    if (card) revealAddedPortalArea(card, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [shownAreas]);
  const [availabilityResult, setAvailabilityResult] = useState<{
    key: string; slots: Record<string, "Belegt" | "Angefragt">; error: string;
  }>({ key: "", slots: {}, error: "" });
  const availabilityKey = `${values.requested_start_date}|${values.requested_end_date}|${campaign.id}|${admin}`;
  const availabilityLoading = availabilityResult.key !== availabilityKey;
  const availability = availabilityLoading ? {} : availabilityResult.slots;
  const availabilityError = availabilityLoading ? "" : availabilityResult.error;
  const hasBookedSelection = values.targets.some((target) =>
    availability[adTargetAvailabilityKey({ ...target, placement: target.placement ?? campaign.placement })] === "Belegt");
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
  const set = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));
  const setTarget = (target: AdTarget, checked: boolean) =>
    setValues((current) => {
      const remaining = current.targets.filter(
        (item) =>
          adTargetAvailabilityKey({ ...item, placement: item.placement ?? campaign.placement }) !== adTargetAvailabilityKey(target),
      );
      return {
        ...current,
        targets: checked ? [...remaining, target] : remaining,
      };
    });
  const availableScopes = availableRequestScopes(shownScopes, shownAreas);
  const renderPlacements = (base: Omit<AdTarget, "placement">) => <div className={styles.placements}>
    {Object.entries(adPlacements).map(([slot, label]) => {
      const target: AdTarget = { ...base, placement: slot as AdPlacementId };
      const key = adTargetAvailabilityKey(target);
      const checked = values.targets.some((item) => adTargetAvailabilityKey({ ...item, placement: item.placement ?? campaign.placement }) === key);
      const slotStatus = slotAvailabilityText(availability[key], checked, availabilityLoading, availabilityError);
      return <label className={styles.placement} key={key}>
        <input type="checkbox" name="targets" value={adTargetFormValue(target)} checked={checked}
          disabled={availabilityLoading || !!availabilityError || (availability[key] === "Belegt" && !checked)}
          onChange={(event) => setTarget(target, event.target.checked)} />
        <span className={styles.placementName}>{label}</span>
        <small className={availability[key] === "Belegt" ? styles.slotBooked : styles.slotAvailability}>{slotStatus}</small>
      </label>;
    })}
  </div>;
  return (
    <form action={action} className={`${styles.form} ${styles.requestForm}`}>
      <input type="hidden" name="campaign_id" value={campaign.id} />
      <input type="hidden" name="placement" value={values.targets[0]?.placement ?? campaign.placement} />
      {!admin && <input type="hidden" name="headline" value={values.headline || values.internal_name.slice(0, 100)} />}
      <fieldset className={styles.formSection}>
        <legend>Ansprechpartner</legend>
        <p className={styles.sectionHint}>So können wir Ihre Anfrage zuordnen und Sie bei Rückfragen erreichen.</p>
        <div className={styles.contactGrid}>
          <label>Name<input name="contact_name" maxLength={120} value={values.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></label>
          <label>E-Mail-Adresse<input name="contact_email" type="email" maxLength={254} value={values.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} /></label>
          <label>Telefonnummer<input name="contact_phone" type="tel" maxLength={60} value={values.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className={styles.formSection}>
        <legend>{admin ? "Kampagnenziel" : "Angaben zur Anzeige"}</legend>
        <div className={styles.formFields}>
          <label>{admin ? "Interner Kampagnenname" : "Bezeichnung der Angebotsanfrage"}
            <input name="internal_name" required maxLength={120} value={values.internal_name} onChange={(e) => set("internal_name", e.target.value)} />
          </label>
          <label>Ziel-URL
            <input type="url" name="target_url" required maxLength={2048} placeholder="https://www.ihre-firma.de" value={values.target_url} onChange={(e) => set("target_url", e.target.value)} />
          </label>
        </div>
      </fieldset>
      <fieldset className={styles.formSection}>
        <legend>Zeitraum</legend>
        <div className={styles.dateGrid}>
          {([
            ["requested_start_date", admin && ["approved", "paused"].includes(campaign.status) ? "Ausspielung ab" : "Gewünschter Start"],
            ["requested_end_date", admin && ["approved", "paused"].includes(campaign.status) ? "Ausspielung bis" : "Gewünschtes Ende"],
          ] as const).map(([field, label]) => (
            <label key={field}>{label}
              <input type="date" name={field} required value={values[field]} onChange={(e) => set(field, e.target.value)} />
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.formSection}>
        <legend>Wo möchten Sie werben?</legend>
        <p className={styles.sectionHint}>Wählen Sie zunächst einen Bereich und danach die passenden Bannerplätze. Weitere Bereiche können Sie jederzeit ergänzen.</p>
        {shownScopes.map((scopeId) => {
          const scope = requestAdScopes.find((item) => item.id === scopeId)!;
          const portalSection = portalAdSections.find((section) => section.id === scope.id);
          return <section key={scope.id} className={styles.scopeGroup} aria-label={scope.name}>
            <div className={styles.scopeHeader}>
              <div><span className={styles.scopeEyebrow}>Werbebereich</span><h3>{scope.name}</h3></div>
              <button type="button" className={styles.removeScope} aria-label={`${scope.name} entfernen`}
                onClick={() => {
                  setValues((current) => ({ ...current, targets: removeRequestScope(current.targets, scope.id) }));
                  setShownScopes((current) => current.filter((id) => id !== scope.id));
                  setShownAreas((current) => current.filter((key) => portalAdSection(key) !== scope.id));
                }}>Bereich entfernen</button>
            </div>
            {portalSection ? <>
              <label className={styles.areaPicker}>Wo innerhalb dieses Bereichs möchten Sie werben?
                <select value="" aria-label={`${portalSection.label}: Rubrik oder Unterrubrik hinzufügen`}
                  ref={(element) => { areaPickers.current[portalSection.id] = element; }} onChange={(event) => {
                  const key = event.target.value;
                  if (portalAdSection(key) === portalSection.id && !shownAreas.includes(key)) {
                    areaToFocus.current = key;
                    setShownAreas((current) => addPortalArea(current, key));
                  }
                }}>
                  <option value="">Rubrik oder Unterrubrik auswählen</option>
                  {portalSection.areas.map((area) => <option key={area.key} value={area.key} disabled={shownAreas.includes(area.key)}>{area.label}</option>)}
                </select>
              </label>
              <p className={styles.sectionHint}>Für diese Rubrik wird eine sichtbare Bannerfläche noch eingerichtet. Ihre Auswahl wird getrennt nach Unterrubrik und Platz geprüft.</p>
              {shownAreas.filter((key) => portalAdSection(key) === portalSection.id).map((key) => <div className={styles.areaCard} key={key}
                role="group" aria-label={portalAdAreaLabel(key)} ref={(element) => { areaCards.current[key] = element; }}>
                <div className={styles.scopeHeader}>
                  <label>Platzierung in
                    <select value={key} onChange={(event) => {
                      const nextKey = event.target.value;
                      if (portalAdSection(nextKey) !== portalSection.id || shownAreas.includes(nextKey)) return;
                      setValues((current) => ({ ...current, targets: changePortalArea(current.targets, key, nextKey) }));
                      setShownAreas((current) => current.map((item) => item === key ? nextKey : item));
                    }}>
                      {portalSection.areas.map((area) => <option key={area.key} value={area.key} disabled={area.key !== key && shownAreas.includes(area.key)}>{area.label}</option>)}
                    </select>
                  </label>
                  <button type="button" className={styles.removeScope} aria-label={`${portalAdAreaLabel(key)} entfernen`}
                    onClick={() => {
                      setValues((current) => ({ ...current, targets: removePortalArea(current.targets, key) }));
                      setShownAreas((current) => current.filter((item) => item !== key));
                    }}>Auswahl entfernen</button>
                </div>
                {renderPlacements({ target_type: "portal_area", category_id: null, target_key: key })}
              </div>)}
            </> : renderPlacements({ target_type: scope.id as "homepage" | "experts_directory", category_id: null })}
          </section>;
        })}
        {availableScopes.length > 0 && <div className={styles.addScope}>
          <button type="button" className={styles.addScopeButton} aria-expanded={scopePickerOpen} aria-controls={scopePickerOpen ? "ad-scope-options" : undefined}
            onClick={() => setScopePickerOpen((open) => !open)}>+ Werbebereich hinzufügen</button>
          {scopePickerOpen && <div id="ad-scope-options" className={styles.scopeOptions} role="group" aria-label="Verfügbare Werbebereiche">
            {availableScopes.map((scope) => <button type="button" key={scope.id} onClick={() => {
              setShownScopes((current) => addRequestScope(current, scope.id));
              setScopePickerOpen(false);
              scopeToFocus.current = scope.id;
            }}>{scope.name}</button>)}
          </div>}
        </div>}
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
        <p className={styles.sectionHint}>Jeder Bannerplatz gilt nur für die ausgewählte Seite. Belegte Plätze können nicht neu gewählt werden.</p>
      </fieldset>
      <fieldset className={styles.formSection}>
        <legend>Haben Sie bereits ein Bannerbild?</legend>
        <p className={styles.sectionHint}>Laden Sie Ihr Bannerbild gerne direkt mit hoch. Falls noch kein passendes Motiv vorhanden ist, melden wir uns bei Ihnen und unterstützen Sie gerne bei der Erstellung.</p>
        <label>Bannerbild hochladen (optional · JPEG, PNG oder WebP, maximal 5 MB)
          <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          />
        </label>
      </fieldset>
      {admin && <label>
        Name / Bezeichnung
        <input
          name="headline"
          required
          maxLength={100}
          value={values.headline}
          onChange={(e) => set("headline", e.target.value)}
        />
      </label>}
      {admin && <BannerSearchFields value={metadata} terms={bannerTerms} onChange={setMetadata} includeName={false} />}
      <fieldset className={styles.formSection}>
        <legend>Hinweise oder Wünsche</legend>
        <p className={styles.sectionHint}>{admin ? "Gibt es etwas, das wir bei Ihrer Kampagne berücksichtigen sollen?" : "Gibt es etwas, das wir bei Ihrer Angebotsanfrage berücksichtigen sollen?"}</p>
        <label>Ihre Hinweise (optional)
        <textarea
          name="body_text"
          maxLength={400}
          rows={3}
          value={values.body_text ?? ""}
          onChange={(e) => set("body_text", e.target.value)}
        />
        </label>
      </fieldset>
      <p>
        {admin ? "Redaktionelle Änderungen an einer freigegebenen Kampagne werden sofort wirksam. Entwürfe werden erst nach Freigabe ausgespielt." : "Mit dem Einreichen wird Ihre Angebotsanfrage zur Prüfung gesendet. Die Anzeige wird erst nach Freigabe im bestätigten Zeitraum ausgespielt."}
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
