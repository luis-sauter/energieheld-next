# P2: Audit der Anbieterbilder

Stand: 2026-10-06; Cloud-Projekt energieheld-dev, Codebasis `1e868124de2158cd4ba3cac05430d1fcb16cc321`.

## Bestand und Ergebnis

Alle 58 vorhandenen, freigegebenen realen Joomla-Anbieter geprüft (31 Premium, 27 Basic). Demo und nicht freigegebene Energieprofile ausgeschlossen. Alle 58 gehören zu einer der vier Destinationen und mindestens einem der zwölf Mottos. Die Detailrotation berücksichtigt weiterhin höchstens 30 Profile pro Rubrik; ihre Auswahl und Reihenfolge wurden nicht verändert.

29 Anbieter können ein bereits vorhandenes geeignetes Foto verwenden: 28 lokale Originaldateien sowie die bestehende gespeicherte Sonnenhof-Galerie. Die serverseitige Fotoauswahl enthält 29 belegte Legacy-Fallbacks einschließlich Sonnenhof. Es wurden keine Dateien kopiert, keine Storage-Objekte oder DB-Medienzeilen angelegt und keine Cloud-Daten geändert. Bei 26 Anbietern fehlen Bildreferenzen vollständig; drei weitere besitzen nur ungeeignete Logos/Angebots-/Webseitengrafiken.

| Destination | Anbieter insgesamt | Geeignetes Foto verfügbar |
| --- | ---: | ---: |
| /reiseziele/deutschland | 27 | 14 |
| /reiseziele/oesterreich | 13 | 6 |
| /reiseziele/schweiz | 5 | 3 |
| /reiseziele/suedtirol-italien | 13 | 6 |

## Darstellung und Provenienz

Reiseziel-/Mottokarten verwenden dieselbe zentral gewählte Medienreferenz unabhängig vom Paket. Gespeicherte Galeriefotos haben Vorrang; sonst dient ein visuell geprüftes Bild aus dem bereits vorhandenen Anbieterbestand als Fallback. Logos und Angebotsgrafiken werden nicht automatisch als großes Reisefoto verwendet. Basic-Unternehmenszeilen behalten bewusst den blauen Haus-Platzhalter auch bei vorhandenen echten Fotos. Premium-Verzeichnisbilder und Profilgalerien bleiben unverändert. Die Entscheidung ist zentral in `src/lib/provider-card-media.ts` zusammengefasst; eine spätere Basic-Logoentscheidung erfordert keine neue Datenstruktur.

Die maschinenlesbare Matrix [reiseportal-provider-image-audit.json](./reiseportal-provider-image-audit.json) enthält Profil-ID, Slug, Paket, aktuelle Terms/Seiten, Cloud-/Legacy-Medienstatus, Joomla-ID, gewähltes Foto, Provenienz und Entscheidung. Alle lokalen Fotofallbacks sind per SHA-256 und Profil-/Artikelzugehörigkeit gegen [reiseportal-legacy-az-assets.json](./reiseportal-legacy-az-assets.json) geprüft. Die Originaldateien wurden visuell geprüft; keine neue Bearbeitung oder destruktive Zuschnitte. Banner wurden nicht als Profilfotos benutzt.

## Bewusst nicht befüllt

| Anbieter | Entscheidung | Grund |
| --- | --- | --- |
| ALFSEEFERIEN- UND ERLEBNISPARK | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Alpenhotel Montafon | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Familienhotel & Kinderhotel Sonnwies | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| FEELFREE NATURE RESORT | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Ferienbauernhof Büchele | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| GOLF- & SPORTHOTEL HOF MARAN | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Haus Terra - Ferienwohnung | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Hotel GODEWIND | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Hotel Mondschein | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Jägeralpe | AMBIGUOUS_SKIP | Nur Logos bzw. Angebots-/Webseitengrafiken belegt; kein geeignetes Fotokartenbild. Bewusst übersprungen. |
| Kaiser Hans - Natur Residence | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Kesselgrub | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Kronplatz | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Lärchenhof | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Landgut Ramshof | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Landhotel Talblick **** | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Lindner Hotel Köln City Plaza | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Mintrops Land Hotel | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| OEWERS Wellness & Spa Hotel | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Pension Steingarten | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Pletzer Resorts Bayrischzell | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| RHÖN PARK AKTIV RESORT | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Schlosshotel Ralswiek | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Small & Beautiful Hotel Gnaid | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Stroblhof | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| SUB Aqua Tauchreisen | AMBIGUOUS_SKIP | Nur Logos bzw. Angebots-/Webseitengrafiken belegt; kein geeignetes Fotokartenbild. Bewusst übersprungen. |
| Villner Hof | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| Wellnesshotel Golfpanorama | NO_IMAGE_FOUND | Artikelbilder, Artikel-HTML und exportierte Medien-Custom-Fields ohne Bildreferenz. Banner nicht als Profilfotos übernommen. |
| WIRODIVE Tauch- und Erlebnisreisen GmbH | AMBIGUOUS_SKIP | Nur Logos bzw. Angebots-/Webseitengrafiken belegt; kein geeignetes Fotokartenbild. Bewusst übersprungen. |

Die 26 bildlosen Anbieter haben im exportierten Joomla-Artikel, Intro-/Fulltext-Bild und Medien-Custom-Fields keine Profilbildzuordnung. Werbebanner oder ähnlich benannte Dateien begründen keine Fotoübernahme. Externe Verzeichnisse/Stock-/KI-Quellen wurden nicht verwendet.

## Sicherheit / Wiederholung

Kein Import erforderlich: geeignete Dateien lagen bereits zentral im bestehenden Medienbestand. Keine Migration, neue Medienarchitektur, Kontakt-/Text-/Taxonomieänderung oder künstliche Review/Freshness-Bestätigung. Sonnenhof: vorhandene Galerie/Logo nicht erneut importiert, überschrieben oder bereinigt; bestehende Redaktionsmedien behalten Vorrang.

Audit erneut erzeugen: `node scripts/audit-reiseportal-provider-images.mjs <read-only-cloud-snapshot.json>`. Das Skript liest die bestehende Cloud-Aufnahme sowie lokale Belege und schreibt nur die Audit-Dokumentation; es führt keine SQL-, Storage- oder Profilmutation aus. Die Rohaufnahme bleibt außerhalb Git.
