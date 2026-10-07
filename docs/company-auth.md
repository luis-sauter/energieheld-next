# Firmenzugang und Onboarding

## Auth und Zuständigkeiten
- `/registrieren` validiert Namen, Firma, E-Mail und Passwort serverseitig. `signUp` erhält `full_name`/`company_name`; nur der bestehende `on_auth_user_created_company`-Trigger erstellt Firma und Entwurfsprofil.
- Hosted **Confirm email** muss aktiviert sein. Ohne Session zeigt die Registrierung den Bestätigungshinweis mit eingegebener E-Mail und Spam-Hinweis. Eine unerwartet sofort ausgestellte Session wird lokal beendet, statt unbestätigten Zugang zu suggerieren.
- `/auth/confirm` akzeptiert `verifyOtp` für `email`/`signup` oder einen PKCE-Code mit verifiziertem Signup-AMR. Erfolg führt fest nach `/firma?willkommen=1`; abgelaufene Links nach `/login?error=confirmation`.
- Login verwendet `signInWithPassword`. Serververifizierte `portal_admins` und `companies.owner_user_id` bestimmen Admin → `/admin`, Owner → `/firma`, unzugeordnet → `/konto`. Die bestehende berechtigte `next`-Allowlist bleibt unverändert.
- Owner-Zugriff auf `/firma` und Speichern läuft weiterhin über `getUser`, eigene Firma, eigenes Profil und RLS; niemals über Metadatenrollen oder übermittelte IDs.

## Ein gemeinsames Profil, drei Schritte
`/firma/profil` und `/firma/profil/gestalten` verwenden dasselbe `company_profiles`-Profil. Erfolgreiches Stammdaten-Speichern führt bereits zur Gestalten-Seite, deren Loader die gespeicherten Werte lädt; keine zweite Tabelle oder Synchronisation.

Draft: Stammdaten → Profil & Bilder → bestehender Erstfreischaltungsbereich `#freischaltung`. Name, Beschreibung, Kontakt, PLZ/Ort und vorhandene Medien geben lediglich Orientierung. Sie erzeugen keine zusätzlichen harten Einreichungspflichten. Automatisch gesetzter Name allein zählt nicht als vorbereiteter Schritt.

Pending: wird geprüft und ist nicht öffentlich. Rejected: Überarbeitung ohne erfundene Begründung. Approved: öffentlicher Profillink und Leistungsüberblick. Nicht veröffentlichte Profile laden keine Statistikmetriken. Persönliche Verifizierung bleibt optional und unabhängig.

Normales Speichern und Medien-Upload veröffentlichen keinen Entwurf. Die vorhandene Erstfreigabe und das bestehende Verhalten nach Erstfreigabe bleiben erhalten.

## Passwort vergessen / zurücksetzen
`/passwort-vergessen` ruft `resetPasswordForEmail` mit sicherem `/auth/recovery`-Redirect auf. Antwort bleibt bei bestehenden, unbekannten oder rate-limitierten Konten neutral; Eingabefehler sind verständlich.

`/auth/recovery` akzeptiert Recovery-TokenHash oder PKCE-Code. Callback, Reset-Seite und Save-Action prüfen signierte `getClaims`-AMR `recovery` (höchstens 30 Minuten alt); zusätzlich prüft `getUser` Sitzungswiderruf und Nutzeridentität. Normales Login oder Signup genügt nicht. Passwörter müssen übereinstimmen und mindestens acht Zeichen haben. `updateUser({ password })`, lokale Abmeldung, danach `/login?passwort=geaendert`. Keine Token-/Passwortlogs, keine frei wählbaren Redirects, keine neue Dependency.

Callbacks entfernen Codes/TokenHash sofort aus der Ziel-URL und setzen `private, no-store` sowie `no-referrer`. Private Auth-Seiten sind noindex/nofollow.

## Hosted-Konfiguration — Prüfung 2026-10-07
Projekt `mbcvlqnxluyxznlnitbq`: Confirm email aktiviert und nach Dashboard-Reload verifiziert. Andere Auth-Provider, RLS, Schema, Daten und SMTP nicht verändert.

Aktuell Default-Vorlagen und Default-Mailversand, kein Custom SMTP. Standard-ConfirmationURL unterstützt PKCE; alternativ unterstützt der Code eigene Vorlagen mit `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup` bzw. `type=recovery`. Kein veralteter Fragment-Token-Flow.

Die vorhandene Allowlist `https://**--startling-choux-aaa598.netlify.app/**` deckt Branch- und immutable QA-Callbacks ab. Sie wurde nicht erweitert. Die spätere Produktionsdomain benötigt explizit `/auth/confirm` und `/auth/recovery` in der Allowlist sowie eine passende Site URL; aktuell ist Site URL die Netlify-Hauptseite. Default SMTP hat niedrige Versandgrenzen und eingeschränkte Empfänger; keine produktionsreife Zustellbarkeit behaupten. Custom SMTP bleibt Launch-Aufgabe.

Security Advisor geprüft: vorhandene Definer-/search_path-/Leaked-Password-Hinweise bleiben separat offen. Keine neuen DB-Funktionen oder Grants in diesem Block.

## Verifikation und Grenzen
Gezielte ausführbare Tests: Signup-Redirect/Mailzustand, unbestätigter Login, Confirmation-Typen, PKCE, Recovery-AMR/Ablauf/Widerruf, Passwortvalidierung/Update/Abmeldung, Neutralität, Onboarding-Zustände, bestehende Owner-/Admin-Grenzen. Finale Gates: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

Live-Mailbestätigung und vollständiges neues Owner-Onboarding erfordern eine separate zugängliche QA-Mailbox. Shared QA-Admin-Passwort niemals ändern. Fehlende Live-Mailprüfung ausdrücklich als offen berichten.

Quellen: [Passwort-Auth](https://supabase.com/docs/guides/auth/passwords), [SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [JWT/AMR](https://supabase.com/docs/guides/auth/jwt-fields), [E-Mail-Vorlagen](https://supabase.com/docs/guides/auth/auth-email-templates).

## Owner-Input und redaktionelle Prüfung

Schritt 1 lädt die bestehenden `travel_terms` und Profilzuordnungen: Unterkunftsart, die drei öffentlichen Zielgruppen und Mottoreisen als Mehrfach-Checkboxen. `business_areas` bleibt als optionaler ergänzender Freitext erhalten. `save_own_travel_profile` speichert Stammdaten und angebotene Begriffe atomar, leitet das eigene Profil aus `auth.uid()` ab und sperrt die Profilzeile gegen gleichzeitige Moderation. Unbekannte/nicht angebotene Zuordnungen bleiben erhalten. Es ändert weder Status noch Eigentümer noch Slug.

Bei `approved` sind Zuordnungen im Owner-Formular schreibgeschützt; RPC und Owner-RLS verhindern deren Änderung. Die Redaktion verwendet weiterhin den bestehenden Admin-Taxonomieeditor. Bestehende Freshness-Trigger auf Profilen und Taxonomie bleiben aktiv.

Der Designer lädt dieselbe Profilzeile nach dem Save und aktiviert die bestehende Google-Maps-Darstellung. Keine zweite Adressquelle. Reisezuordnungen werden dort angezeigt.

Optionale Hinweise liegen ausschließlich in `company_profile_editorial_notes`, nicht im öffentlichen Profil. Maximal 4.000 Zeichen Plaintext; leere Eingabe wird als NULL gespeichert. Owner lesen/schreiben nur die eigene Row, Admins lesen alle, anon besitzt keine Rechte. Die Save-Action verwendet ausschließlich die serverseitig ermittelte Profil-ID. Keine Aufnahme in Such-/SEO-Projektionen oder Freischaltungspflichten.

Migrationen: `20261007171635_owner_editorial_notes.sql` und `20261007171657_owner_travel_profile_save.sql`. Beide additiv, keine Bestandsdatenänderung. Profil-/Auth-/Storage-RLS bleibt unverändert. Zusätzliche Taxonomie-Policies betreffen ausschließlich das eigene unveröffentlichte Profil. Neue RPC ist SECURITY INVOKER; öffentliche Ausführung ist widerrufen.

Versionierte gebrandete Mailquellen: [Auth-Templates](auth-email-templates/README.md). Hosted Default SMTP erlaubt derzeit keine Templatebearbeitung: `CUSTOM_SMTP_REQUIRED`. Sender und realer gebrandeter Versand bleiben eine separate Konfigurationsprüfung nach Bereitstellung einer verifizierten SMTP-Konfiguration.
