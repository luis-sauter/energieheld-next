# Portal-Korrektur und Mehrfachziele für Werbung

Ausgangspunkt: `25f3ae2dadde8a7a38ec530684b796530c5ce4f8`, ausschließlich
Branch `feature/portal-frontend`.

## Oberfläche

- Navigation: Experten A–Z, Gewerke, So funktioniert’s; CTA „Als Experte eintragen“.
- Zentrale Blau-/Orange-/Weiß-/Grau-Tokens in `src/app/globals.css`;
  öffentliche Seiten, Firmenbereich und Admin verwenden dieselben Tokens.
  Dunkler neutraler Fließtext und neutrale Sekundärtexte sind keine weiteren Markenfarben.
- Die gemischte Startseite mit Energie-/Handwerks- und Reiseinhalten sowie ihrer
  bestehenden Abschnittsfolge bleibt erhalten. Der Unternehmenshinweis bleibt dezent.
- `ListingRow` erhält Anbieter, Kategorien und Profil-Link als Props und kann auch
  für Reiseanbieter verwendet werden.
- Profilkopf mit Name, Kategorien und optionalem Siegel; darunter links Kontakt
  einschließlich Logo, rechts Standort. Beschreibung, Galerie und Leistungen folgen.
- Die vorhandenen öffentlichen Spaltenrechte werden nicht erweitert: PLZ, Ort und
  Region stehen zur Verfügung; `street` ist öffentlich bislang nicht freigegeben.
  Es werden weder Kontaktpersonen noch Koordinaten erfunden. Ohne präzise Position
  zeigt das Profil einen erklärten Standort-Fallback und gegebenenfalls eine Ortssuche.
- Das originale Siegel stammt von
  [Energieheld](https://energieheld.bayern/images/zertifikat/LQ_verifiziert.png)
  und liegt unverändert unter `public/images/energieheld-verifiziert.png`.
  Kleine Listen- und größere Profilansicht; Sichtbarkeit und Prüfworkflow bleiben unverändert.
- Firmenübersicht kompakter; Zeitraumwahl und detaillierte Auswertung bleiben unter
  `/firma/statistiken`. Analytics-Erfassung bleibt deaktiviert.

## Datenmodell und Migration

Neue, **nicht remote angewendete** Migration:
`supabase/migrations/20260918202110_company_ad_campaign_targets.sql`.

`company_ad_campaign_targets` enthält `campaign_id`, `target_type` und `category_id`.
Zulässig sind `experts_directory` ohne Kategorie und `trade` mit gültiger Kategorie.
Eine Unique-Constraint mit `NULLS NOT DISTINCT` verhindert auch doppelte Expertenziele.
Der Fremdschlüssel löscht Targets beim Löschen ihrer Kampagne mit.

Backfill:

- `experts_directory` wird zu einem Expertenziel.
- `trade` wird zu einem Gewerkziel mit derselben Kategorie.
- `all_trades` wird zum vollständigen versionierten Satz der 15 bereits bestehenden
  offiziellen Kategorien. So bleibt der alte Umfang nachvollziehbar.
- Sämtliche Kampagnenzeilen bleiben unverändert: insbesondere IDs, Profilbezug,
  Creative, Storage-Pfad, Status, Zeiträume, Adminentscheidung, Notizen und Zeitstempel.
- `scope_type` und `category_id` bleiben als ausdrücklich deprecated historische
  Felder erhalten. Nach der Migration sind allein die Target-Zeilen maßgeblich.
- Die Migration ist als Ganzes in einer Transaktion auszuführen. Eine Tabellensperre
  verhindert konkurrierende alte Kampagnenschreibvorgänge während des Backfills.

Alte Targets ohne aktuelle offizielle Firmenzuordnung bleiben gespeichert und werden
in der Firmen-/Adminansicht benannt, aber dort nicht ausgespielt. Freigabe und
Reaktivierung werden blockiert, bis die Auswahl bzw. offizielle Zuordnung korrigiert
ist. Bei einer freigegebenen Kampagne bleiben andere gültige Targets aktiv.
Eine Ablehnung ermöglicht bei eingereichten Kampagnen die Korrektur durch die Firma.
Pausierte Kampagnen behalten den bisherigen Workflow und sind nicht frei editierbar.

Die bestehende Kategorie Energieberatung erhält ebenfalls eine Verzeichnisroute,
damit jedes zulässige Gewerkziel eine erreichbare Zielseite besitzt. Die 14 Kacheln
der Baugewerke-Übersicht bleiben unverändert.

## Autorisierung und Buchungskonflikte

- Target-Tabelle mit RLS; authentifizierte Eigentümer und Admins lesen ausschließlich
  über die bestehende Kampagnen-RLS. Kein anonymer Tabellenzugriff, keine direkten
  INSERT-/UPDATE-/DELETE-Rechte für API-Rollen.
- Schreibzugriffe bleiben in den bestehenden autorisierten RPCs. Die Server Action
  validiert die Auswahl zusätzlich vor Medienoperationen.
- Die Save-RPC verlangt mindestens ein Target, prüft Form, Allowlist, Duplikate und
  `company_profile_categories` anhand des authentifizierten Kampagneneigentümers.
  Ausgewählte Zuordnungszeilen bleiben bis Transaktionsende gegen Löschung gesperrt.
- Freigabe und Reaktivierung prüfen die aktuelle Zuordnung erneut.
- Der vorhandene globale `pg_advisory_xact_lock(20260917,203041)` serialisiert die
  Buchungsentscheidungen. `READ COMMITTED` ist zwingend; nach Warten auf die Sperre
  sieht die Konfliktabfrage den aktuellen Stand. Konflikte gelten für gemeinsames
  Target, identisches Placement und inklusive Datumsüberschneidung.
- Die öffentliche RPC projiziert weiterhin nur Creative-Felder und filtert pro
  Zielseite, Status, bestätigtem Zeitraum und aktueller Firmenzuordnung.
- Firmen-, Profil-, Kategorien-, Lead-, Qualitäts- und Analytics-RLS bleiben
  unverändert. Der private Medienbucket und seine Regeln bleiben unverändert.

## Rollout-Grenze

Die neue Target-Tabelle und die aktualisierten RPCs müssen **separat freigegeben und
angewendet werden**, bevor die neue Werbeverwaltung auf einer Umgebung vollständig
genutzt werden kann. Dieses Frontend erwartet das neue Schema; ein Push dieses
Branches wendet die Migration nicht an. Bei automatischem Branch-Deployment gilt
diese Einschränkung entsprechend. Keine Remote-Migration wurde ausgeführt.

## Verifikation

`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

Ergebnis: 212 Tests bestanden, Lint, Typecheck und Produktionsbuild erfolgreich.
Nach der abschließenden Sicherung des Formularzustands wurden die 11 betroffenen
Werbe-/UI-Tests, Lint und der Produktionsbuild einschließlich TypeScript erneut
erfolgreich ausgeführt.

Die lokalen PGlite-Tests prüfen den Backfill gegen Bestandskampagnen in allen fünf
Workflowstatus und vergleichen jede Kampagnenspalte vor/nach der Migration.
Weitere Fälle: Eigentümer-/Admin-/Anon-Zugriffe, direkte Schreibverbote,
manipulierte Targets, atomarer Rollback, Mehrfachausspielung, entfernte Zuordnungen,
Datumsgrenzen, verschiedene Placements, Konflikte und Mehrfach-Reaktivierung,
Constraints und kaskadierende Löschung.

Die Transaktionssperre und die Ablehnung veralteter Isolations-Snapshots werden
geprüft. PGlite ist kein Test mit zwei gleichzeitig laufenden PostgreSQL-Sessions;
ein echter paralleler Live-Test wurde nicht durchgeführt.

UI-Tests prüfen die erlaubten Checkboxen, gleichzeitige Auswahl, vollständige
Adminanzeige, gemeinsame Creative-Komponente und Verzeichnisrouten sämtlicher
offizieller Kategorien. Bestehende Auth-, Profil-, Medien-, Lead-, Qualitäts- und
Analytics-Regressionsfälle bleiben Teil der Suite.

Lokale Browserprüfungen verwenden öffentliche Seiten und eine statisch aus den
Produktionskomponenten gerenderte Werbeformular-Fixture. Diese Fixture schreibt
weder in Supabase noch in die Anwendung. Angemeldete Live-Schreibabläufe wurden
ohne passende Testsitzungen nicht ausgeführt.

Im Browser geprüft: Startseite und Profil auf Desktop und bei 390 Pixel Breite,
Expertennavigation, Energieberatungs-Verzeichnis, Original-Siegel und Erklärdialog,
Öffnen des Kontaktformulars ohne Absenden sowie Login-Weiterleitung von `/firma`.
Die geprüften mobilen Seiten und das Werbeformular haben keinen horizontalen
Überlauf; in der öffentlichen Browsersitzung wurden keine Konsolenwarnungen oder
-fehler erfasst.

## Geänderte Dateien

- Seiten: `src/app/(energieheld)/page.tsx`, `firma/page.tsx`,
  `gewerke/[slug]/page.tsx` (die beiden letzten relativ zu derselben Routengruppe).
- Basis: `src/app/globals.css`, `src/config/energieheld.ts`,
  `src/config/reiseportal.ts`, `src/types/portal.ts`.
- Portal: `src/components/portal/directory-page.tsx`, `listing-row.tsx`,
  `listing-detail.tsx`, `company-profile.css`.
- Werbung: `src/lib/ad-values.ts`, `src/lib/ad-campaigns.ts` sowie
  `src/components/advertising/campaign-form.tsx`, `campaign-pages.tsx`,
  `campaign-view.tsx`, `advertising.module.css`.
- Siegel: `src/components/quality/quality-seal.tsx`, `quality.module.css`,
  `public/images/energieheld-verifiziert.png`.
- Gemeinsame Farbverwendung: `src/components/admin/admin.module.css`,
  `src/components/auth/auth.module.css`, `src/components/dashboard/dashboard.module.css`,
  `src/components/leads/leads.module.css`.
- Datenbank: `supabase/migrations/20260918202110_company_ad_campaign_targets.sql`.
- Tests: `tests/ad-campaigns.test.mjs`, `tests/ad-targets-db.test.mjs`,
  `tests/ad-targets-ui.test.mjs`.
- Dokumentation: `docs/portal-correction-pass.md`.
