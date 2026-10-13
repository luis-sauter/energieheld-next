# Europa-Standortübersicht

`europe.svg`: abgeleitet aus Natural Earth 1:50m Admin 0 Countries, Version 5.1.2.
Quelle: https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
Lizenz: Public Domain, https://www.naturalearthdata.com/about/terms-of-use/

Projektion: sphärische Lambert-Kegelprojektion mit Standardparallelen 43° und 62°,
Mittelmeridian 10° Ost, Ursprungsbreite 49°. SVG 1400 × 620; gleiche Projektion
für Länder und Standortpunkte. Für die Übersicht vereinfachte Grenzen, keine Navigationskarte.

Standortkoordinaten: © OpenStreetMap-Mitwirkende, ODbL 1.0.
https://www.openstreetmap.org/copyright
Der abgeleitete Koordinatenbestand ist im öffentlichen Quellrepository in
`src/data/company-locations.json` verfügbar und steht unter ODbL 1.0;
dies bezieht sich auf die Standortdaten, nicht auf den Anwendungscode.
Es werden nur öffentliche Profil-IDs und geografische Koordinaten verwendet.
Die angezeigten Punkte werden zusätzlich durch die aktuelle öffentliche
Profilansicht und den unveränderten Adress-Fingerprint gefiltert.

Stand: 13.10.2026, 106 veröffentlichte Profile überprüft; 95 belastbare
Gebäude-/Betriebspositionen, 11 ohne ausreichend verlässliche Position.
Keine Orts-, Länder- oder Regionsmittelpunkte als Ersatz.

Aktualisierung: nach Veröffentlichung oder Adressänderung gezielt eine aktuelle
öffentliche Profil-/Adressliste und geprüfte Standortnachweise bereitstellen.
Bereits passende Cache-Ergebnisse wiederverwenden. Neue/unklare Adressen nur
redaktionell geokodieren und prüfen; kein automatischer Geocoder im Build.
Der lokale Generator wird ausdrücklich aufgerufen:

`node scripts/build-europe-map.mjs countries.geojson public-profiles.json reviewed-locations.json`

Eingaben bleiben außerhalb des Repositorys. `reviewed-locations.json` enthält
IDs, lat/lon und `verified: true` nur nach Herkunfts-/Adressprüfung. Das Skript
führt keine Netzwerk- oder Datenbankschreibvorgänge aus. Änderungen an SVG,
Standorten und serverseitigen Adress-Fingerprints prüfen, committen und über
den bestehenden Feature-Deploy ausliefern. Kein periodischer Hintergrundjob.

Archivier-/Veröffentlichungsänderungen wirken bei der vorhandenen öffentlichen
Verzeichnisabfrage sofort auch auf die dargestellten Punkte; neue Profile
werden nach gezielter Snapshot-Aktualisierung ergänzt. Geänderte Adressen
werden bis zur erneuten Koordinatenprüfung nicht mit alten Positionen dargestellt.
