# DAS Reiseportal

Next.js-Portal aus der Energieheld-Codebasis: Unterkünfte entdecken, nach Reisezielen und Mottoreisen filtern und Anbieter kontaktieren. Die Anwendung enthält Supabase-Auth, einen Anbieterbereich, einen Admin-Profil-Editor, private Medien, Werbekampagnen und gespeicherte Anfragen.

## Voraussetzungen

- Node.js 24 LTS.
- pnpm 11.19.0 gemäß `package.json`.
- Next.js 16, React 19 und TypeScript im Strict-Modus. Exakte Versionen stehen in [package.json](package.json).

## Lokal starten

```sh
pnpm install --frozen-lockfile
```

Bei der ersten Einrichtung `.env.example` als Vorlage für `.env.local` verwenden. Eine vorhandene `.env.local` beibehalten. `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` auf das vorgesehene Supabase-Projekt setzen. Diese Variablen sind öffentlich; dort keine Secret- oder Service-Role-Keys eintragen. Lokale Umgebungsdateien werden nicht versioniert.

```sh
pnpm dev
```

Die Anwendung unter http://localhost:3000 öffnen. Nach Änderungen an Umgebungsvariablen den Server neu starten.

## Prüfungen und Build

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm start` benötigt einen erfolgreichen Build. Entwicklungs- und Produktionsserver verwenden standardmäßig denselben Port; nur einen davon starten. Tests prüfen unter anderem Fachlogik, SQL mit PGlite und statisches React-Markup. Interaktive Browserabläufe werden separat geprüft.

## Projektstruktur

- `src/app/`: App-Router-Seiten, Layouts, Serveraktionen und Route-Handler.
- `src/components/`, `src/lib/`, `src/config/`: Komponenten, Fachlogik und Konfiguration.
- `src/lib/supabase/`: Browser-, SSR- und öffentliche Clients. Der Proxy aktualisiert Sessions; geschützte Operationen prüfen ihre Berechtigung serverseitig.
- `public/`: statische Bilder, zugeordnete Legacy-Medien und Video.
- `supabase/migrations/`: SQL-Migrationen; `supabase/config.toml` konfiguriert den optionalen lokalen Stack.
- `tests/`: automatisierte Prüfungen; `docs/` und `scripts/`: Dokumentation und Importwerkzeuge.
- `netlify.toml`: Deployment mit `pnpm build` und dem Next.js-Plugin.

## Supabase und Deployment

Die Anwendung verwendet Supabase Auth, RLS und private Medien-Buckets. Öffentliche Medien werden über signierte URLs geladen. Die CLI-Anmeldung ist unabhängig von der App-Verbindung. Zugangstokens und Datenbankpasswörter gehören nicht in Git oder öffentliche Next.js-Variablen.

Lokale SQL-Dateien und CLI-Konfiguration bestätigen nicht, welche Migrationen in einer Cloud-Umgebung angewendet sind. Cloud-Änderungen separat prüfen; ein Frontend-Branch isoliert die Datenbank nicht automatisch.

Grundlagen: [Next.js](https://nextjs.org/docs/app), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) und [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
