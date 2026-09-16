# Firmenzugang

## Ablauf

- `/registrieren` validiert alle Eingaben serverseitig und ruft `signUp` mit
  `full_name` und `company_name` in `options.data` auf. Nur der vorhandene
  Datenbank-Trigger legt Firma und Profile an.
- `/login` verwendet `signInWithPassword` und leitet nach `/firma` weiter.
- `/auth/confirm` prüft `token_hash` mit `verifyOtp`; erlaubt sind die
  E-Mail-Bestätigungstypen `email` und `signup`. Ziele sind fest vorgegeben.
- `/firma` verwendet `getUser` zur serverseitigen Identitätsprüfung und liest
  mit dem Publishable Key und der Nutzersitzung über RLS. Zusätzlich wird auf
  `companies.owner_user_id = user.id` und dann die eigene `company_id` gefiltert.
- Logout läuft als Server Action über `signOut` und leitet nach `/` weiter.
- `/firma/profil` lädt das eigene Profil serverseitig. Die Server Action ermittelt
  bei jedem Speichern die Firmenzuordnung erneut über den verifizierten Nutzer.
  Nur die zehn freigegebenen Formularfelder werden übernommen; IDs, Slug,
  Status und Zeitstempel aus dem Formular werden ignoriert.
- Normales Speichern erhält `draft` bzw. `pending`. Änderungen an `approved`
  oder `rejected` werden als `draft` gespeichert. Einreichen speichert die
  Formulardaten zusammen mit `pending` und der serverseitigen `submitted_at`
  atomar. Eine zwischenzeitliche Statusänderung führt zum Konflikthinweis.
- Eine zusätzliche, genehmigte Migration erlaubt UPDATE nur auf diesen zehn
  Feldern sowie `status` und `submitted_at`. RLS bleibt unverändert und verhindert
  fremde Zugriffe sowie Selbstfreigaben. Es entstehen keine neuen Tabellen.

## Vorhandene Datenbank und Leserechte

Die vorhandenen Tabellen, Trigger und RLS-Regeln wurden nicht geändert.
Zwei freigegebene Migrationen ergänzen die zuvor fehlenden Leserechte für
`authenticated`: SELECT auf `companies` und `company_profiles` sowie SELECT
auf `portal_admins.user_id`, das die bestehenden RLS-Regeln abfragen.
Die RLS-Regel auf `portal_admins` erlaubt nur den eigenen Eintrag.
Beide Migrationen sind bereits auf `energieheld-dev` angewendet.
Sie setzen die bestehende Datenbankstruktur voraus; sie sind kein vollständiges
Schema für eine leere Datenbank.

## Supabase-Einstellungen für Bestätigungs-E-Mails

Der Route Handler setzt eine passende **Confirm signup**-Mailvorlage unter
Supabase Authentication → Email Templates voraus. Der Bestätigungslink muss
`token_hash` an die Anwendung senden, statt nur `ConfirmationURL` zu verwenden:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">E-Mail-Adresse bestätigen</a>
```

Die Registrierung setzt `emailRedirectTo` auf den aktuellen Ursprung plus
`/auth/confirm`. Unter Authentication → URL Configuration müssen die tatsächliche
Netlify-Branch-URL mit `/auth/confirm` und bei lokalen Tests z. B.
`http://localhost:3001/auth/confirm` als Redirect URLs erlaubt sein. Site URL auf
die gewünschte öffentliche Anwendungs-URL setzen. Keine beliebigen fremden
Domains freigeben.

Diese Repository-Änderung verändert keine Supabase-Dashboard-Einstellungen.
Dokumentation: https://supabase.com/docs/guides/auth/server-side/nextjs

## Verifikation

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
Die Auth-Tests prüfen serverseitige Validierung und die Zuordnung von Nutzer,
Firma und Profil einschließlich fehlender/ungültiger Sitzungen.
Für einen vollständigen Live-Test: mit eigener E-Mail registrieren, E-Mail
bestätigen, Entwurf im Firmenbereich prüfen, ausloggen und den gesperrten
Firmenbereich erneut aufrufen. Mit zwei getrennten Konten prüfen, dass jeweils
nur die eigene Firma erscheint. Keine Service-Role-Keys erforderlich.
