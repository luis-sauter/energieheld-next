# Frontend-Vorschau: Energieheld 2.0

## Stand und Umfang

Eine einzelne Next.js-Anwendung mit App Router und TypeScript Strict. Es wurden keine zusätzlichen Laufzeitbibliotheken installiert. Supabase-Clients, Proxy, CLI-Verknüpfung und Migrationen bleiben unverändert. Alle acht Betriebe, das Hotel, deren Kontaktdaten, Auszeichnungen und Werbemotive sind fiktive Vorschauinhalte. Keine Daten werden gespeichert oder an eine Business-API gesendet.

## Seiten

| Route               | Inhalt                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                 | Markeneinstieg, Expertensuche, sechs Gewerke, drei Beispielprofile, Portalerklärung und Unternehmens-CTA                                           |
| `/experten`         | Suche, Kategorie, Ort/PLZ, Leistung, Sortierung, Ergebnisanzahl, Filterzusammenfassung und Leerzustand                                             |
| `/experten/[slug]`  | Acht statisch generierte Profile mit Beispiellogo, Beschreibung, Galerie, Leistungen, Standort, Kontaktplatzhaltern und separatem Qualitätsbereich |
| `/fuer-unternehmen` | Erklärung des künftigen Eintrags; keine Registrierung und keine Datenerfassung                                                                     |
| `/portal-vorschau`  | Technischer Wiederverwendungsnachweis: dieselbe ListingCard und ListingDetail für ein Hotel, dazu vier eigenständige Mock-Werbeplätze              |

Unbekannte Profile liefern eine 404-Seite. Die Portal-Vorschau ist nicht in der Energieheld-Hauptnavigation verlinkt. Die Vorschau setzt `noindex, nofollow`, damit Mock-Profile nicht als echte Angebote indexiert werden; das ist kein Zugriffsschutz.

## Gemeinsamer Kern

- `src/types/portal.ts`: verständliche Typen für Listing, Category, Location, Bilder, BrandConfig und Werbung. Keine Datenbankmodelle oder generische Framework-Schicht.
- `src/components/portal/`: PortalHeader, PortalFooter, HeroSearch, FilterPanel, MobileFilters, CategoryGrid, ListingCard, ListingGrid, ListingDetail, ContactSection, ImageGallery, Badge, EmptyState, AdSlot und AdBanner.
- `src/lib/listings.ts`: reine Filterfunktion auf übergebenen Arrays, ohne Datenbankzugriff. Suche, Ort, Kategorie und Leistung lassen sich kombinieren. Name/Ort werden deutsch sortiert. Die Eingangsdaten werden nicht verändert.
- `src/data/`: statische Beispielanbieter und unabhängige Banner-Mock-Daten.
- `src/config/energieheld.ts` und `reiseportal.ts`: Markennamen, einfache Farbwerte, Kategorien, Navigation, Anbieterbegriffe und CTAs. CSS-Variablen übertragen die Farben; keine Theme Engine.

Cards und Detailprofile erhalten Daten und Kategorien als Props. Der Qualitätsbereich wird optional übergeben: Ein Hotel bekommt dadurch nicht versehentlich einen Energieheld-Stempel. Werbebanner verwenden eigene Typen und Komponenten, keine ListingCard.

## Bewusst Energieheld-spezifisch

Die öffentliche Homepage, Texte, Gewerke, Experten-Routen, Unternehmensseite, Wortmarke und Qualitätsstempel-Erklärung. Suche und CategoryGrid verwenden zunächst die Energieheld-Routen; die darunterliegenden Daten- und Listing-Bausteine sind bereits für beide Portale nutzbar. Das Reiseportal bleibt eine Komponenten-Demonstration und ist keine zweite Anwendung.

## Suche und Interaktion

GET-Formulare speichern `q`, `kategorie`, `ort`, `leistung` und `sort` in der URL. Links sind teilbar; Zurücksetzen und Browser-Navigation funktionieren ohne einen globalen Zustandsspeicher. Die Auswahl wird auf dem Server ausschließlich gegen Mock-Daten gefiltert. Ortssuche bedeutet Text-/PLZ-Abgleich, keine Umkreissuche oder Geocodierung.

Clientseitiges JavaScript beschränkt sich auf Bilderauswahl und mobile Filter. Auf kleinen Displays können die Filter geöffnet und geschlossen werden; am Desktop sind sie direkt sichtbar. Native Formulare, Labels, Fokusmarkierungen, semantische Navigation, ein Sprunglink und reduzierte Bewegung bilden die Accessibility-Grundlage.

## Werbung und Qualitätsstempel

`AdCreative` beschreibt Placement, Werbekunde, Bild mit Alternativtext, Ziel-URL, Aktivstatus, Start-/Enddatum, geografische Zuordnung, Kategorien und Priorität. Diese Felder bilden nur den künftigen Vertrag ab. Es gibt keine automatische Kampagnenauswahl, Zeitsteuerung, Abrechnung oder Messung von Klicks/Impressionen.

`AdSlot` stellt den Platz bereit und kennzeichnet ihn als Anzeige/Demobanner. `AdBanner` rendert das Motiv. Die Vorschau ordnet explizit einen großen `destination_top`-Banner und drei `destination_sidebar_*`-Banner zu. Auf kleinen Displays stehen die drei Sidebar-Anzeigen in voller Inhaltsbreite unter den Listings. Banner führen zu einem erklärenden Demo-Hinweis, nicht zu einem Buchungsangebot.

`QualityBadge` ist ein separates Präsentationsobjekt. Die einzige Badge-Demo ist ausdrücklich als Vorschau beschriftet. Es wurden keine Zertifikate, Freigabestatus, Zahlungen oder Prüfworkflows implementiert.

## Referenzanalyse und Bildquellen

Geprüft wurden beide Startseiten, die Energieheld-Expertenübersicht und eine Detailseite sowie die Deutschland-Übersicht des Reiseportals. Energieheld zeigt eine blau-orange Markenwelt, Gewerke, Unternehmensprofile und einen eigenständigen Verifizierungshinweis. Das Reiseportal verwendet Unterkunfts-/Reiseziel-Kategorien sowie einen horizontalen Banner und gestapelte Seitenbanner. Die neue UI entwickelt die Hierarchie und das responsive Layout weiter, ohne die Seiten pixelgenau zu kopieren.

- [Energieheld](https://energieheld.bayern/)
- [Bestehende Expertenübersicht](https://energieheld.bayern/experten-a-z)
- [Reiseportal](https://das-reiseportal.com/)
- [Deutschland-Übersicht mit Werbung](https://das-reiseportal.com/reiseziele/deutschland)

Für die lokale Vorschau liegen folgende Referenzdateien in `public/images/`:

- `energieheld-logo.jpg`: `/images/logos/livinQ-logo-356w.jpg` von energieheld.bayern; bestehende Energieheld-Wortmarke.
- `house.jpg`: `/images/headers/home/startseite-03-1280x720.jpg` von energieheld.bayern.
- `solar.jpg`: `/images/headers/home/startseite-07-1280x960.jpg` von energieheld.bayern.
- `home.jpg`: `/images/headers/home/startseite-02-1280x720.jpg` von energieheld.bayern.
- `mountains.svg`: eigens erstellte, illustrative Mock-Grafik für Hotel und Werbung.

Referenzfotos werden ausschließlich als Symbolbilder verwendet, nicht als angebliche Projekte der fiktiven Firmen. Die Dateien werden lokal ausgeliefert; es gibt keine externen Bild-, Font- oder Kartenaufrufe.

## Validierung

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Die sechs Node-Tests prüfen kombinierte Filter, Postleitzahl, leere Ergebnisse, unveränderte Ausgangsdaten beim Sortieren, Mehrwortsuche und Wiederverwendung für Hotel-Daten. Node.js 24 kann die TypeScript-Dateien für diese Tests direkt lesen; dafür ist kein zusätzlicher Test-Runner installiert.

Browserprüfung mit Edge/Playwright bei 320, 390, 768 und 1440 Pixeln: Seitenaufrufe, Suche, Leerzustand/Zurücksetzen, Galerie, Bilder, mobile Darstellung und 404. Ein erkannter Galerieüberlauf wurde korrigiert. Die vollständige Prüfung auf Barrierefreiheit und echte Endgeräte folgt nach Designfreigabe.

## Sinnvolle nächste Schritte

1. Design, Navigation, Filterbegriffe und Detailprofil mit echten Nutzungsfällen freigeben.
2. Verbindliche Inhalte und Bildauswahl für reale Unternehmen vorbereiten.
3. Erst danach Datenmodell und Freigabeprozesse separat planen: Listing, Qualitätsantrag und Werbekampagne bleiben getrennte Konzepte.
4. Nach Freigabe Datenbankmigrationen, Authentifizierung und Berechtigungen entwickeln; vorhandene UI schrittweise an echte Daten anbinden.

Diese Phase ist nur zur lokalen Begutachtung vorgesehen. Commit und Push erfolgen erst nach ausdrücklicher Freigabe.
