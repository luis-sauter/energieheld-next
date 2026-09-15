# Energieheld

Minimales Next.js-Projekt mit TypeScript, App Router und ESLint. Noch keine Businesslogik, Datenbankanbindung oder Supabase-Tabellen.

## Voraussetzungen

- Node.js 24 LTS (mit Version 24.19.0 geprüft)
- pnpm 11.19.0 (in `package.json` festgelegt)

Falls pnpm noch fehlt, mit einer regulären Node.js-/npm-Installation: `npm install --global pnpm@11.19.0`.

## Lokal starten

Im Projektverzeichnis ausführen:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Anschließend http://localhost:3000 öffnen. Änderungen an `src/app/page.tsx` werden automatisch übernommen. Mit Strg+C wird der Server beendet.

## Prüfungen und Produktionsbetrieb

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

`pnpm start` benötigt zuvor einen erfolgreichen Build. Entwicklungs- und Produktionsserver verwenden standardmäßig Port 3000; immer nur einen davon starten.

## Projektstruktur

- `src/app/page.tsx`: Startseite unter `/`.
- `src/app/layout.tsx`: Gemeinsames HTML-Grundlayout, Sprache und Metadaten.
- `src/app/globals.css`: Globale Basisstile und Hell-/Dunkelmodus.
- `src/app/page.module.css`: Lokal auf die Startseite begrenzte Stile.
- `src/app/favicon.ico`: Browser-Icon aus dem Next.js-Template.
- `public/`: Platz für statische Dateien; `.gitkeep` hält den zunächst leeren Ordner in Git.
- `package.json`: Abhängigkeiten, Paketmanager und Entwicklungsbefehle.
- `pnpm-lock.yaml`: Exakte Auflösung der Abhängigkeiten für reproduzierbare Installationen.
- `pnpm-workspace.yaml`: Vom Generator angelegte pnpm-Konfiguration für Build-Skripte von Abhängigkeiten.
- `tsconfig.json`: TypeScript im Strict-Modus; Importalias `@/*` verweist auf `src/*`.
- `next.config.ts`: Zentrale Next.js-Konfiguration.
- `eslint.config.mjs`: Next.js- und TypeScript-Regeln für die Codeprüfung.
- `.gitignore`: Schließt Abhängigkeiten, Build-Ausgaben und lokale Umgebungsdateien aus Git aus.
- `AGENTS.md` und `CLAUDE.md`: Vom Generator angelegte Hinweise für Coding-Assistenten.

`node_modules/`, `.next/` und `next-env.d.ts` werden automatisch erzeugt und nicht versioniert. Weitere Ordner für Komponenten oder Anwendungslogik können bei Bedarf unter `src/` ergänzt werden.

Die Startseite nutzt Systemschriften, sodass der Build keine Schriftarten herunterladen muss. Für den Start sind keine Umgebungsvariablen erforderlich.

Grundlage: [Offizielle Next.js-Installation](https://nextjs.org/docs/app/getting-started/installation).
