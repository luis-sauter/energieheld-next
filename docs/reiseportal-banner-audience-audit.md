# Banner-Zielgruppen und Quicklink-Polish

Stand: 2026-10-06. Bestehende Banner-Taxonomie und Werbekundenidentitäten bleiben die Datenbasis; keine Migration.

## Kontrollierte Zuordnung

Nur die drei belegten allgemeinen Hauptbanner erhalten sechs bestehende Audience-Terms. Der exakte idempotente Import steht in [SQL](reiseportal-banner-audience-assignments.sql) und prüft Identität, Hauptbanner, approved Profil und dessen belegte Relation.

| Bestehender Banner | Zielgruppen | Beleg |
| --- | --- | --- |
| Annis Romantikhäuschen, `https://annis-romantikhaeuschen.de/` | Zu zweit | Bestehende Joomla-/Profilzuordnung `anni-romantikhaeuschen`, Romantic-Unterkunft; keine Hundezuordnung |
| Höflehner, `https://hoeflehner.com/` | Mit Hund, Mit Kindern | Bestehende Familie-Zuordnung und offiziell geprüfte Hunde-FAQ |
| Feldhof, `https://feldhof.com/` | Mit Hund, Mit Kindern, Zu zweit | Bestehende Familie-Zuordnung, Hunde-Buchungsinfos und dedizierter Romantikurlaub |

Quellen und Einschränkungen: [Profil-Audit](reiseportal-audience-evidence-audit.md), [Details](reiseportal-audience-evidence-audit.json). Es werden keine anderen Creatives desselben Kunden automatisch zugeordnet. Filter prüfen jeden Bannerinhalt für sich; anschließend wird pro bestehender Werbekundenidentität ein Treffer ausgewählt. Kombinierte Filter dürfen keine Angaben verschiedener Creatives zusammenführen.

Cloud-Verifikation: Bannerrelations 6 → 12. Profile, Profilrelations, Kampagnen, Booking-Targets, Presentation, Metadaten und Policies sowie alle sechs alten Bannerrelations per Hash unverändert. Öffentliche Projektion liefert die neuen Terms; anon besitzt keine Schreibrechte. Keine Schema-/RLS-/Storageänderung.

## Darstellung

Der gemeinsame Bannereditor zeigt Mit Hund / Mit Kindern / Zu zweit außerhalb der Kategorien-Klappfläche. Identität und übrige Kategorien bleiben beim Umschalten erhalten. Finder, Facetten und A–Z zählen deduplizierte Anzeigen mit; gemischte Treffer heißen Ergebnisse, reine Unterkunftstreffer weiterhin Unterkünfte.

Alle drei Icons werden zentral über `TravelThemeIcon` gerendert. Der Hundehintergrund ist ein generiertes, generisches Reise-Inspirationsmotiv, kein reales Anbieterfoto. Imagegen-Prompt: freundlicher Golden Retriever an einem ruhigen Alpensee, Berge, natürliches Sonnenlicht, einfache quadratische Komposition ohne Text/Logo/Personen. Lokal als 512×512 WebP, 50.668 Bytes; bestehendes Lazy-Loading, blauer Overlay und Scroller-Pausen bleiben erhalten. Keine zusätzlichen Dependencies, Queries pro Karte oder Client-Komponenten.
