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
  `review_company_profile` mit festem `approved` bzw. `rejected` auf.
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
