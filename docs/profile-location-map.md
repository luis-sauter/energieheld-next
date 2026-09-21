# Öffentliche Profilkarte

Visuelle Referenz: https://energieheld.bayern/experten-a-z/liste/bame-group
(am 21.09.2026 im Browser geprüft): Kontaktbox links, breite Google-Karte rechts.

Die öffentliche Profilroute aktiviert die Karte in der bestehenden Profilkomponente.
Firmeneditor und andere Aufrufer behalten ihre bisherige Darstellung.
Demo-Profile erhalten keine Google-Karte und keinen echten Standortlink.

- Straße mit Hausnummer, PLZ und Ort: adressbasierte Google-Suche, Zoom 16.
- Ort mit PLZ/Region/Land oder PLZ mit Land: Ortsübersicht, Zoom 12,
  ausdrücklich keine genaue Firmenposition. Unvollständige Straßenangaben werden
  für diese Ortsübersicht nicht verwendet.
- Nur Region/Land, ein unqualifizierter Ortsname oder leere Daten: bisheriger Fallback.
- Keine Koordinaten, Firmenpositionen oder Adressen werden ergänzt oder abgeleitet.
- Embed und Öffnen-Link verwenden dieselbe URL-kodierte Standortabfrage.

## Bestehende öffentliche Datengrenze

`src/lib/public-companies.ts` liefert `postal_code`, `city`, `region`, `country`,
aber kein `street`. Auch `CompanyPresentation` und `companyProfileListing` in
`src/lib/company-presentation.ts` übernehmen keine Straße. `Listing.location.street`
ist bereits optional vorgesehen. Daher sind die aktuellen echten öffentlichen
Profile weiterhin Ortsübersichten, keine präzisen Firmenpositionen.

Für genaue Adresskarten wäre als separate Änderung erforderlich: öffentliche
Lesefreigabe der vorhandenen Spalte `company_profiles.street` nach bewusster
Freigabe dieser Veröffentlichung, Aufnahme in `publicFields`/`PublicProfile`
und Weitergabe über `CompanyPresentation`/`companyProfileListing` an `location.street`.
Außerdem muss der gespeicherte Straßenwert die Hausnummer enthalten.
Keine dieser Backend-/Spaltenrechte-Änderungen wurde hier vorgenommen.

## Externer Dienst

Google Maps wird per HTTPS-Iframe mit `q`, `z` und `output=embed` geladen,
ohne SDK, Paket, API-Key oder kostenpflichtige Maps-API. Die Karte bleibt ein
externer Google-Dienst; beim Laden wird Google kontaktiert. Die Karte im oberen
Profilbereich lädt direkt; `strict-origin-when-cross-origin` übermittelt an Google
nur den Website-Ursprung, nicht den Profilpfad. Der separate Öffnen-Link bleibt verfügbar,
auch wenn der Browser das Iframe blockiert. Google bestimmt die Suchauflösung;
eine adressbasierte Suche garantiert keinen verifizierten Firmeneintrag.

## Prüfung

20 relevante Tests bestanden; Lint, Typecheck und Produktionsbuild erfolgreich.
Geprüft sind URL-Kodierung, vollständige/unvollständige Adressen, grobe Orte,
leere Angaben, Demo-Fallback und die unveränderte Reihenfolge der Profilabschnitte.

Browser: öffentliche Profilansicht bei 1280 und 390 Pixel Breite geprüft;
Kontaktbox links/Karte rechts auf Desktop, untereinander auf Mobile, kein
horizontaler Überlauf. Öffnen-Link vorhanden, Demo-Profil ohne Iframe.
Keine Konsolenfehler. Einschränkung: Im lokalen integrierten Browser blieb das
Google-Frame-Dokument auf `about:blank`, auch bei direktem Laden. Die externe
Live-Referenz lud ihre Karte. Deshalb ist die tatsächliche Google-Kartenausspielung
auf unserem Profil noch nicht visuell bestätigt; nach Deployment im Zielbrowser
prüfen. Das responsive Kartenlayout wurde geprüft, nicht als geladene Karte gewertet.
