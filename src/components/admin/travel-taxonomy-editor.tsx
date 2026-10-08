"use client";
import Link from "next/link";
import { useState } from "react";
import { TravelThemeIcon } from "@/components/portal/travel-theme-icon";
import { publicTravelLabel } from "@/lib/travel-presentation";
import { travelFilterPreview, travelTermIcon } from "@/lib/travel-review-state";
import { useTravelReview } from "./travel-review-context";
import styles from "./admin.module.css";

const groups = [["theme", "Mottoreisen"], ["audience", "Zielgruppen"], ["accommodation", "Unterkunftsarten"], ["feature", "Interne Merkmale"]] as const;
export function TravelTaxonomyEditor({ published = false }: { published?: boolean }) {
  const review = useTravelReview();
  const [query, setQuery] = useState("");
  const [dimension, setDimension] = useState("all");
  if (!review) return <p role="alert">Die Reisezuordnungen konnten nicht geladen werden.</p>;
  const { terms, proposedKeys, assignedKeys, selected, busy, dirty, saving, message, revision } = review;
  const proposed = terms.filter(term => proposedKeys.includes(term.term_key));
  const preview = travelFilterPreview(terms, selected);
  return <section aria-label="Reisezuordnungen" aria-busy={saving}>
    <h2>Reisezuordnungen</h2>
    <section className={styles.travelBriefing} aria-labelledby="host-travel-title">
      <h3 id="host-travel-title">Vom Gastgeber angegeben</h3>
      <p>Diese Angaben wurden vom Gastgeber vorgeschlagen und sind noch nicht automatisch redaktionell bestätigt.</p>
      {!proposed.length ? <p>Der Gastgeber hat noch keine Reisebereiche vorgeschlagen.</p> : <ul className={styles.travelChips}>{proposed.map(term => <li key={term.term_key}>
        <TravelThemeIcon slug={travelTermIcon(term)} /><span>{publicTravelLabel(term.term_key, term.label)}<small>{assignedKeys.includes(term.term_key) ? "Bereits bestätigt" : selected.includes(term.term_key) ? "Zur Übernahme ausgewählt · noch nicht gespeichert" : "Vorschlag · nicht übernommen"}</small></span>
      </li>)}</ul>}
      <p>Bereits bestätigte Reisebereiche sehen Sie unten. Gastgebervorschläge werden separat angezeigt.</p>
    </section>
    <h3>Redaktionelle Entscheidung</h3>
    <p>Wählen Sie nur belegte Reisebereiche. Vorschläge übernehmen Sie bewusst über die Auswahl; weitere vorhandene Begriffe können Sie ergänzen. Abgewählte Vorschläge bleiben unbestätigt.</p>
    <div className={styles.travelFilters}>
      <label>Reisebegriff suchen<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Begriff eingeben" /></label>
      <label>Gruppe<select value={dimension} onChange={event => setDimension(event.target.value)}><option value="all">Alle Gruppen</option>{groups.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    {groups.filter(([key]) => dimension === "all" || key === dimension).map(([key, label]) => {
      const options = terms.filter(term => term.dimension === key && publicTravelLabel(term.term_key, term.label).toLocaleLowerCase("de").includes(query.toLocaleLowerCase("de")));
      return <fieldset key={key} className={styles.travelGroup} disabled={busy}><legend>{label}</legend>
        {!options.length && <p>{query ? "Keine passenden Reisebegriffe." : "Keine belegten Optionen vorhanden."}</p>}
        <div className={styles.travelChoices}>{options.map(term => <label key={term.term_key} className={styles.travelChoice} data-assigned={selected.includes(term.term_key)}>
          <input type="checkbox" checked={selected.includes(term.term_key)} onChange={() => review.toggle(term.term_key)} />
          <TravelThemeIcon slug={travelTermIcon(term)} />
          <span>{publicTravelLabel(term.term_key, term.label)}<small>{assignedKeys.includes(term.term_key) ? selected.includes(term.term_key) ? "Bestätigt und gespeichert" : "Entfernen · noch nicht gespeichert" : selected.includes(term.term_key) ? "Ausgewählt · noch nicht gespeichert" : proposedKeys.includes(term.term_key) ? "Gastgebervorschlag" : "Nicht zugeordnet"}</small></span>
        </label>)}</div>
      </fieldset>;
    })}
    <section className={styles.travelBriefing} aria-labelledby="travel-preview-title">
      <h3 id="travel-preview-title">So wird die Unterkunft auffindbar</h3>
      <p>{dirty ? "Vorschau Ihrer Auswahl — noch nicht gespeichert." : "Gespeicherte Reisezuordnungen."} {!published && "Öffentlich wirksam erst nach Veröffentlichung des Profils."}</p>
      {!preview.length ? <p>Keine Reisebereiche ausgewählt.</p> : <ul className={styles.travelPreview}>{preview.map(term => <li key={term.term_key}>{term.href ? <Link href={term.href}>{groups.find(([key]) => key === term.dimension)?.[1]} → {term.label}</Link> : <span>{term.label} · internes Merkmal, kein öffentlicher Filter</span>}</li>)}</ul>}
      <p>Nicht übernommene Gastgebervorschläge schränken keine öffentlichen Suchfilter ein.</p>
    </section>
    <div className={styles.actions}><button type="button" className="button button-primary" disabled={busy || !dirty || revision === undefined} onClick={review.save}>{saving ? "Speichert …" : "Reisezuordnungen speichern"}</button></div>
    {revision === undefined && <p role="alert">Der aktuelle Profilstand fehlt. Bitte laden Sie die Profilprüfung neu.</p>}
    {dirty && <p role="status">Ungespeicherte Reiseauswahl. Bitte vor der Veröffentlichung speichern.</p>}
    {message.error && <p role="alert">{message.error} <a href="#reisezuordnungen" onClick={() => window.location.reload()}>Profilprüfung neu laden</a></p>}
    {message.success && !dirty && <p role="status">{message.success}</p>}
  </section>;
}
