# Energieheld

Next.js mit TypeScript, App Router, ESLint und technischer Supabase-Anbindung. Keine Businesslogik, Login-Oberfläche oder Business-Tabellen.

## Voraussetzungen

- Node.js 24 LTS (mit Version 24.19.0 geprüft)
- pnpm 11.19.0 (in `package.json` festgelegt)

Falls pnpm noch fehlt: `npm install --global pnpm@11.19.0` mit einer regulären Node.js-/npm-Installation.

## Lokal starten

```sh
pnpm install --frozen-lockfile
```

Beim ersten Einrichten `.env.example` nach `.env.local` kopieren und den Publishable Key aus den API-Key-Einstellungen von **energieheld-dev** eintragen. Eine bereits vorhandene `.env.local` beibehalten.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://mbcvlqnxluyxznlnitbq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Diese beiden Werte werden im Browser verwendet. Keine Secret- oder Service-Role-Keys einsetzen. `.env.local` und andere lokale Umgebungsdateien werden von Git ignoriert; nur `.env.example` wird versioniert.

```sh
pnpm dev
```

http://localhost:3000 öffnen. Änderungen werden automatisch übernommen; Strg+C beendet den Server. Nach Änderungen an Umgebungsvariablen den Server neu starten. Fehlende Supabase-Variablen führen beim ersten Aufruf zu einer verständlichen Fehlermeldung.

## Prüfungen und Produktionsbetrieb

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

`pnpm start` benötigt einen erfolgreichen Build. Entwicklungs- und Produktionsserver verwenden standardmäßig Port 3000; immer nur einen davon starten. Die öffentlichen Supabase-Variablen müssen auch in einer Deployment-Umgebung vor dem Build gesetzt sein.

## Projektstruktur

- `src/app/`: App-Router-Seiten, HTML-Grundlayout, Metadaten, Basisstile und Browser-Icon.
- `src/lib/supabase/client.ts`: Browser-Client mit Cookie-Verwaltung über `@supabase/ssr`; Import in Client Components.
- `src/lib/supabase/server.ts`: Neuer Server-Client pro Request mit `await cookies()`; `server-only` verhindert versehentliche Browser-Imports. In Server Components mit `await createClient()` verwenden.
- `src/lib/supabase/env.ts`: Gemeinsame Prüfung der beiden benötigten Umgebungsvariablen, ohne ihre Werte zu protokollieren.
- `src/lib/supabase/proxy.ts`: Technische Session-Aktualisierung über `getClaims()`; überträgt aktualisierte Cookies und Cache-Schutz-Header.
- `src/proxy.ts`: Bindet diese Aktualisierung vor Seitenaufrufen ein; statische Assets werden ausgenommen. Enthält keine Login-Weiterleitungen oder Zugriffsbeschränkungen.
- `public/`: Statische Dateien; `.gitkeep` hält den leeren Ordner in Git.
- `supabase/config.toml`: Von der CLI erzeugte Konfiguration für den optionalen lokalen Supabase-Stack (Postgres 17). Seed-Daten sind deaktiviert. Dies ist keine Änderung der Cloud-Konfiguration.
- `supabase/migrations/`: Platz für spätere SQL-Migrationen; bisher nur `.gitkeep`, keine Migration und keine Tabelle.
- `supabase/.gitignore`: Ignoriert temporäre CLI-Verbindungsdaten und lokale Supabase-Dateien.
- `.env.example`: Vorlage mit Variablennamen und öffentlicher Projekt-URL, ohne Key.
- `package.json`: Abhängigkeiten und Befehle. Supabase-Pakete und CLI sind auf exakte Versionen festgelegt.
- `pnpm-lock.yaml`: Reproduzierbare Auflösung aller Abhängigkeiten.
- `pnpm-workspace.yaml`: Vom Next.js-Generator angelegte pnpm-Konfiguration für Build-Skripte von Abhängigkeiten.
- `tsconfig.json`: TypeScript im Strict-Modus; `@/*` verweist auf `src/*`.
- `next.config.ts` und `eslint.config.mjs`: Next.js-Konfiguration und Codeprüfregeln.
- `.gitignore`: Ignoriert Abhängigkeiten, Build-Ausgaben und Umgebungsdateien.
- `AGENTS.md` und `CLAUDE.md`: Vom Next.js-Generator angelegte Hinweise für Coding-Assistenten.

`node_modules/`, `.next/` und `next-env.d.ts` werden automatisch erzeugt und nicht versioniert.

## Supabase CLI und spätere Migrationen

Cloud-Projekt: **energieheld-dev**, Referenz `mbcvlqnxluyxznlnitbq` (Frankfurt).

Die Webanwendung verbindet sich über `.env.local`. Die CLI benötigt eine separate persönliche Anmeldung, unabhängig von der Supabase-Verbindung in Codex:

```sh
pnpm exec supabase login
pnpm supabase:link
```

Der Link-Befehl ist fest auf `energieheld-dev` eingestellt. Zugangstokens und Datenbankpasswörter gehören weder in Git noch in die öffentlichen Next.js-Variablen. CLI-Verbindungsdaten unter `supabase/.temp/` werden nicht versioniert; nach einem neuen Clone erneut anmelden und verknüpfen.

Für eine spätere, tatsächlich gewünschte Schemaänderung:

```sh
pnpm exec supabase migration new beschreibung_der_aenderung
```

Die CLI erzeugt eine SQL-Datei mit Zeitstempel unter `supabase/migrations/`. Diese wird zusammen mit der geprüften Schemaänderung versioniert. Es wurden bisher keine Migrationen auf die Cloud-Datenbank angewendet.

Optional kann später mit Docker Desktop und `pnpm exec supabase start` ein lokaler Supabase-Stack gestartet werden. Für die Verbindung zum vorhandenen Cloud-Projekt ist Docker nicht erforderlich. Die Konfiguration unter `supabase/config.toml` ist für diesen lokalen Stack gedacht; `project_id` ist dessen lokaler Bezeichner, nicht die Cloud-Projektreferenz.

Auth-Seiten und fachliche Zugriffsregeln werden erst bei Bedarf ergänzt. Neue Auth-Route-Handler müssen ihre eigenen Antworten inklusive Cookies und Cache-Schutz korrekt behandeln; die vorhandene Session-Aktualisierung ersetzt keine Autorisierungsprüfung.

Grundlagen: [Next.js-Installation](https://nextjs.org/docs/app/getting-started/installation) und [Supabase-Clients für SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
