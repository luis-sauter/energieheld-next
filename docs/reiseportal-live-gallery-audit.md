# P2 — Vollständiger Live-/Galerie-Abgleich

Stand 2026-10-06; Ausgangs-HEAD `56b7a77f6022f7c06f1ff59ebef3f74c03a4a979`. P2 bleibt bis manueller Abnahme aktiv.

CUA: 7 alte A–Z-Seiten, 12 Motto-Erstseiten + 4 Folgeseiten, 33 tatsächlich gerenderte alte Anbieter-Detailseiten, alle 58 neuen Profilseiten. Ergänzend öffentliche HTML-Bildquellen, Joomla/Repo-Inventar und SHA-Abgleich; 405 eindeutige lokale Assets visuell geprüft. Nicht nur Hero/erstes Bild. Alte Seiten haben Inhaltsbildsequenzen, keine zusätzliche Carousel-Galerie. Signierte URLs/Zugangsdaten nicht gespeichert.

## Ergebnis

29 vorher offene Anbieter: **1 Foto bestätigt (Jägeralpe), 26 weiterhin ohne Foto, 2 ungeeignet (SUB Aqua/WIRODIVE)**.

32 Anbieter besitzen alte Detail-Bildsequenzen; 30 davon geeignete Fotos. **238 SHA-distinkte geeignete Anbieter-/Umgebungsbilder: 222 im neuen Profil vorhanden, 16 fehlend. 14 vorhandene Dateien zentral wiederverknüpft, 2 über bestehende Admin-Medienlogik gespeichert. Keine verbleibende belegte Fotolücke.** Keine neue Datei im Repo und keine Seitenkopien/Hotlinks.

Cloud-Galerien: Jägeralpe 0 → 1, Sonnenhof 5 → 6; insgesamt 8 → 10 inklusive Demo. Die anderen gespeicherten Medienzeilen unverändert. Profile/Taxonomie unverändert (Hashes in JSON). Freshness wird durch vorhandene Medien-Trigger fortgeschrieben; keine Reviewbestätigung. Keine Migration/RLS-/Bucketänderung.

Die übrigen Galerien bleiben bestehende zentrale, lokale Legacy-Fallbacks; dies ist **kein vollständiger Supabase-Galerieimport**. Ein einzelner Cloud-Upload würde ihren bisherigen umfangreichen Bestand verdrängen, zudem gilt die bestehende Grenze von acht Cloud-Bildern. Deshalb werden dort bestehende Dateien im vorhandenen zentralen Profilmedienmodell wiederverwendet.

## Alle Anbieter / Vorher–Nachher

| Anbieter / Joomla | Live-Bezug | Alte geeignete Fotos | Bereits vorhanden | Fehlend | Galerie vorher → nachher | Ergebnis |
|---|---|---:|---:|---:|---:|---|
| ALFSEEFERIEN- UND ERLEBNISPARK / 474 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=30) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Alpenhotel Montafon / 487 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=30) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Anni´s Romantikhäuschen in der Sächsische Schweiz / 450 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/anni´s-romantikhäuschen-in-der-sächsische-schweiz) | 12 | 11 | 1 | 11 → 12 | EXISTING_CONFIRMED |
| Apartbauernhof Valrunzhof / 506 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/apartbauernhof-valrunzhof) | 6 | 5 | 1 | 9 → 10 | EXISTING_CONFIRMED |
| Appartementhaus Salzburg / 507 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/appartementhaus-salzburg-up) | 4 | 4 | 0 | 10 → 10 | EXISTING_CONFIRMED |
| Bayerischer Wald / 443 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/bayerischer-wald) | 7 | 6 | 1 | 6 → 7 | EXISTING_CONFIRMED |
| Blausee / 473 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/blausee) | 2 | 2 | 0 | 9 → 9 | EXISTING_CONFIRMED |
| Camping Resort Allweglehen / 467 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/camping-resort-allweglehen) | 3 | 3 | 0 | 6 → 6 | EXISTING_CONFIRMED |
| City Apart Dresden / 447 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/city-apart-dresden) | 9 | 9 | 0 | 9 → 9 | EXISTING_CONFIRMED |
| Das 5-Sterne-Wellness-Hotel STOCK resort / 451 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/das-5-sterne-wellness-hotel-stock-resort) | 9 | 9 | 0 | 9 → 9 | EXISTING_CONFIRMED |
| Der Königsleitner - Romantik zu Zweit / 504 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/der-königsleitner) | 23 | 23 | 0 | 31 → 31 | EXISTING_CONFIRMED |
| Familienhotel & Kinderhotel Sonnwies / 476 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| FEELFREE NATURE RESORT / 488 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| FELDHOF DOLCEVITA RESORT / 460 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/feldhof) | 5 | 4 | 1 | 7 → 8 | EXISTING_CONFIRMED |
| Ferienbauernhof Büchele / 455 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Ferienwohnung Sieber / 446 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/ferienwohnung-sieber) | 6 | 6 | 0 | 6 → 6 | EXISTING_CONFIRMED |
| GOLF- & SPORTHOTEL HOF MARAN / 483 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| 5* Golfurlaub Südtirol- Das Golfhotel Andreus / 452 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/5-golfurlaub-südtirol-das-golfhotel-andreus) | 16 | 15 | 1 | 16 → 17 | EXISTING_CONFIRMED |
| Haus Terra - Ferienwohnung / 490 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Höflehner / 464 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/höflehner) | 2 | 2 | 0 | 5 → 5 | EXISTING_CONFIRMED |
| Hotel GODEWIND / 494 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Hotel Mondschein / 489 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Hotel Ravelli Luxury Spa / 505 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/hotel-ravelli-luxury-spaita) | 18 | 18 | 0 | 33 → 33 | EXISTING_CONFIRMED |
| Hotel Salzburger Hof / 502 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/hotel-salzburger-hof) | 16 | 16 | 0 | 32 → 32 | EXISTING_CONFIRMED |
| Hotel zur Post / 457 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/hotel-zur-post) | 1 | 0 | 1 | 5 → 6 | EXISTING_CONFIRMED |
| Jägeralpe / 463 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/jägeralpe) | 1 | 0 | 1 | 5 → 1 | IMPORT_CONFIRMED |
| Kaiser Hans - Natur Residence / 481 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=30) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Kemmeriboden-Bad / 472 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/kemmeriboden-bad) | 4 | 3 | 1 | 5 → 6 | EXISTING_CONFIRMED |
| Kesselgrub / 485 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Kronplatz / 477 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Lärchenhof / 491 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Landgasthof "Neue Schänke" / 442 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/landgasthof-neue-schänke) | 3 | 2 | 1 | 2 → 3 | EXISTING_CONFIRMED |
| Landgut Ramshof / 498 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=40) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Landhotel Talblick **** / 492 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Lindner Hotel Köln City Plaza / 496 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Mintrops Land Hotel / 499 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| OEWERS Wellness & Spa Hotel / 493 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| OSTSEE - BARFUSSpark / 449 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/ostsee-barfusspark) | 13 | 12 | 1 | 19 → 20 | EXISTING_CONFIRMED |
| OVERSUM Vital Resort im Hochsauerland / 453 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/oversum-vital-resort-im-hochsauerland) | 17 | 16 | 1 | 17 → 18 | EXISTING_CONFIRMED |
| Pension Sonnenhof / 470 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/pension-sonnenhof) | 4 | 3 | 1 | 5 → 6 | EXISTING_CONFIRMED |
| Pension Steingarten / 479 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=30) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Platzl Hotel / 456 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/platzl-hotel) | 3 | 2 | 1 | 8 → 9 | EXISTING_CONFIRMED |
| Pletzer Resorts Bayrischzell / 497 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| RHÖN PARK AKTIV RESORT / 500 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Rü Blanch / 471 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/rü-blanch) | 4 | 3 | 1 | 4 → 5 | EXISTING_CONFIRMED |
| Schafhuber / 465 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/schafhuber) | 8 | 7 | 1 | 8 → 9 | EXISTING_CONFIRMED |
| Schlosshotel Ralswiek / 495 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Schwarzwälderhof / 469 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/schwarzwälderhof) | 5 | 5 | 0 | 8 → 8 | EXISTING_CONFIRMED |
| Small & Beautiful Hotel Gnaid / 484 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=50) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Stroblhof / 478 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=60) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| SUB Aqua Tauchreisen / 459 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/sub-aqua-tauchreisen) | 0 | 0 | 0 | 4 → 4 | AMBIGUOUS_SKIP |
| The Chedi / 466 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/the-chedi) | 2 | 2 | 0 | 6 → 6 | EXISTING_CONFIRMED |
| Urlaub auf Borkum / 448 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/urlaub-auf-borkum) | 18 | 17 | 1 | 20 → 21 | EXISTING_CONFIRMED |
| Villner Hof / 480 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=30) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| Wellnesshotel Almhof Call / 501 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z/liste/wellnesshotel-almhof-call) | 8 | 8 | 0 | 12 → 12 | EXISTING_CONFIRMED |
| Wellnesshotel Golfpanorama / 482 | [alte Seite](https://das-reiseportal.com/unterk%C3%BCnfte-a-z?start=60) | 0 | 0 | 0 | 0 → 0 | NO_IMAGE_FOUND_CONFIRMED |
| WIRODIVE Tauch- und Erlebnisreisen GmbH / 458 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/wirodive-tauch-und-erlebnisreisen-gmbh) | 0 | 0 | 0 | 6 → 6 | AMBIGUOUS_SKIP |
| Wirthshof / 468 | [alte Seite](https://das-reiseportal.com/unterkünfte-a-z/liste/wirthshof) | 9 | 9 | 0 | 10 → 10 | EXISTING_CONFIRMED |

## Grenzen / bewusst nicht übernommen

Logos, Angebotsgrafiken, Text-/Webseitenscreenshots und ein als Fotolia gekennzeichnetes Motiv werden nicht als neue Fotos übernommen. Alte wiederholte Quellen werden per Anbieter/SHA einmal gezählt. Kemmeriboden enthält live ein Rü-Blanch-Fremdlogo; nicht zugeordnet. SUB Aqua und WIRODIVE zeigen Angebote/Logo/Portrait statt geeigneter Anbieterfotos. Jägeralpes vier Angebotsgrafiken sind keine Fotos; das separat belegte saubere Kontaktfeldfoto wurde gespeichert.

Die 26 bildlosen alten A–Z-Einträge haben keinen verlinkten Detail-/Galeriebestand; daraus lässt sich keine historische Galerie rekonstruieren. Dies ist kein Beleg, dass der Anbieter andernorts keine Fotos besitzt. Externe Anbieterwebsites/Google/Stock/KI wurden nicht genutzt.

Sonnenhof: Angebot und Handwerker-Testbild in gespeicherter Galerie sowie redaktionelle/Test-Contentmedien dokumentiert, nicht gelöscht. Neue lokale Galerien können ebenfalls bereits historische Grafiken enthalten; dieser Audit importiert sie nicht erneut und verändert keine guten redaktionellen Uploads. Basic-Unternehmensdarstellung bleibt Hausplatzhalter.

Vollständige Quelle, Rolle, SHA, lokales Asset und gegebenenfalls Storage-Zuordnung pro Foto sowie Begründung für jeden offenen Fall: [JSON](reiseportal-live-gallery-audit.json).
