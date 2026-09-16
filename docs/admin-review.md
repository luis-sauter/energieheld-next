# Admin-Firmenprüfung

- `/admin`: serverseitig geschützte Übersicht mit Statuskennzahlen und nach
  Einreichungsdatum aufsteigend sortierter Pending-Liste.
- `/admin/firmen/[id]`: schreibgeschützte Profildetails und zwei Review-Aktionen.
  Die ID bezeichnet `company_profiles.id`, nicht `companies.id`.
- `checkAdmin` verwendet `auth.getUser()` und fragt `portal_admins.user_id`
  ausschließlich mit der verifizierten Nutzer-ID ab. Fehler sperren den Zugriff.
  Seiten und Server Actions verwenden dieselbe Prüfung. Ohne Sitzung geht es
  nach `/login`, ohne Adminrolle zur 404-Seite.
- Die getrennten Server Actions `approveProfile` und `rejectProfile` rufen
  nach erneuter Adminprüfung ausschließlich die bestehende RPC
  `review_company_profile_with_categories` mit festem `approved` bzw. `rejected` auf.
  Es gibt keine normale Status-Update-Abfrage im Admin-Code.
- Die RPC prüft Berechtigung und Pending-Status erneut und setzt `approved_at`.
  Die UI deaktiviert die Aktionen bei allen anderen Statuswerten sowie während
  einer laufenden Aktion. Backend-Fehler werden in deutsche Meldungen übersetzt.
- Erfolgreiche Prüfungen aktualisieren die Adminübersicht, Detailseite,
  `/experten` sowie die betroffenen Firmenansichten. Öffentliche Listings bleiben
  unverändert auf ihren bisherigen Mockdaten.

## Migration-Parität

`20260916121415_add_admin_profile_review_rpc` ist bereits auf Supabase angewendet.
Die entsprechende SQL-Datei fehlt derzeit im Repository. Sie wurde ausdrücklich
nicht rekonstruiert oder erneut angewendet; die Synchronisierung erfolgt separat.
Dieser Schritt ändert keine Datenbankstruktur, RLS oder Admin-Zuordnungen.

## Tests

`tests/admin-review.test.mjs` prüft Zugriff, Rollenprüfung, Review-Queue,
feste Entscheidungen, manipulierte Eingaben, UI-Status und RPC-Fehler.
Bestehende Auth- und Firmenprofiltests bleiben erhalten.

## Tätigkeitsbereiche und öffentliche Gewerke

`business_areas` ist eine frei bearbeitbare Firmenangabe. Sie wird niemals
automatisch in Kategorien umgewandelt und muss zum Einreichen ausgefüllt sein.
Offizielle Zuordnungen stehen getrennt in `company_profile_categories` und
können von Firmen nur gelesen werden. Die Admin-Checkboxen verwenden direkt
`energieheld.categories`; bisherige Zuordnungen sind vorausgewählt.

Die neue RPC ersetzt bei Freigabe alle Zuordnungen atomar und setzt anschließend
den Status. Mindestens ein gültiges Gewerk ist Pflicht. Ablehnen benötigt keines
und behält bestehende Zuordnungen. Auch erneute Firmenbearbeitung löscht keine
Zuordnungen. Die alte RPC verweigert Freigaben ohne vorhandenes Gewerk.
Zusätzliche verzögerte Integritätsprüfungen verhindern ein `approved` ohne
Zuordnung, auch bei direkten Datenbank-Updates.

### Separate Datenbankfreigabe erforderlich

`20260916145904_add_company_categories_and_admin_assignment.sql` wurde nur im
Repository angelegt, **nicht remote angewendet**. Sie ergänzt die Spalte,
Zuordnungstabelle, RLS/Grants, die neue RPC und die minimale Härtung der alten RPC.
Vor Aktivierung dieses Frontend-Stands muss diese Migration kontrolliert
angewendet werden. Die neuen Spalten/RPCs sind bis dahin remote nicht verfügbar.
Die fehlende historische RPC-Migration bleibt eine separate Aufgabe.

Altprofil-Schutz: Falls bereits `approved`-Profile existieren, bricht die Migration
vor der ersten Schemaänderung mit einem Hinweis ab. Ihre Freigaben werden nicht
automatisch geändert. Die Behandlung dieser Profile (kontrollierte erneute
Prüfung bzw. abgestimmter Backfill) muss vor Anwendung separat geklärt werden.
So entsteht beim Umstieg kein freigegebenes Profil ohne offizielle Zuordnung.

RLS verwendet bestehende Eigentümer-/Adminprüfungen. Für anonyme SELECT-Prüfungen
gewährt die Migration nur die notwendigen Spaltenrechte auf den referenzierten
Tabellen; deren bestehende RLS bleibt aktiv. Kategorie-Schreibrechte sind für
`anon` und `authenticated` entzogen. Nur die adminprüfende RPC schreibt.

Die SQL-Allowlist ist ein versionierter Snapshot der kanonischen Code-Kategorien.
Ein lokaler Test vergleicht beide Listen. Neue Gewerke benötigen später auch eine
entsprechende Migration. PostgreSQL-Verhalten wird mit der reinen Dev Dependency
PGlite lokal im Speicher geprüft; dabei wird keine Supabase-Datenbank angesprochen.
