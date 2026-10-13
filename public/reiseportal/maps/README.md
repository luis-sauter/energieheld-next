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

Stand: 13.10.2026, 106 veröffentlichte Profile überprüft; 104 belastbare
Gebäude-/Betriebspositionen, zwei ohne ausreichend verlässliche Position.
Die ursprünglichen 95 Koordinaten bleiben unverändert; neun Positionen anhand
offizieller Betreiberangaben und zwei gezielten OSM-Gebäudereferenzen ergänzt.
46 gültige Kampagnen geprüft: keine weiteren eindeutig eigenständigen
Werbekunden ohne öffentliches Profil; vier Domain-Zuordnungen sind bekannte
Profilunternehmen und erzeugen keine doppelten Marker.
Keine Orts-, Länder- oder Regionsmittelpunkte als Ersatz.

Marker: wiederverwendbarer lokaler SVG-Tropfen, Spitze bei (0,0) exakt an
der geografischen Position. Standardansicht 125 %, entsprechend dem bisherigen
einmaligen Plus-Schritt; Reset und Pos1 kehren dorthin zurück. Herauszoomen
bis zur vollständigen Europakarte bleibt möglich.

Aktualisierung: nach Veröffentlichung oder Adressänderung gezielt eine aktuelle
öffentliche Profil-/Adressliste und geprüfte Standortnachweise bereitstellen.
Bereits passende Cache-Ergebnisse wiederverwenden. Neue/unklare Adressen nur
redaktionell geokodieren und prüfen; kein automatischer Geocoder im Build.
Der lokale Generator wird ausdrücklich aufgerufen:

`node scripts/build-europe-map.mjs countries.geojson public-profiles.json reviewed-locations.json [reviewed-advertisers.json]`

Eingaben bleiben außerhalb des Repositorys. `reviewed-locations.json` enthält
IDs, lat/lon und `verified: true` nur nach Herkunfts-/Adressprüfung. Das Skript
führt keine Netzwerk- oder Datenbankschreibvorgänge aus. Änderungen an SVG,
Standorten und serverseitigen Adress-Fingerprints prüfen, committen und über
den bestehenden Feature-Deploy ausliefern. Kein periodischer Hintergrundjob.

Archivier-/Veröffentlichungsänderungen wirken bei der vorhandenen öffentlichen
Verzeichnisabfrage sofort auch auf die dargestellten Punkte; neue Profile
werden nach gezielter Snapshot-Aktualisierung ergänzt. Geänderte Adressen
werden bis zur erneuten Koordinatenprüfung nicht mit alten Positionen dargestellt.

Bannerkunden ohne öffentliche Präsentation: dieselbe Koordinatenliste verwenden,
zusätzlich den Standort in `company-location-advertisers.json` mit geprüfter
Werbekundenidentität und konkreten Kampagnen-IDs zuordnen. Profil-/Domain-Aliasse
verwenden dieselbe Standort-ID. Unterschiedliche Betriebsstandorte benötigen
eindeutige eigene Nachweise und Kampagnenzuordnungen. Der Generator lehnt
mehrdeutige Kampagnenzuordnungen und stilles Überschreiben geprüfter Positionen ab.
Zur Laufzeit wird die bereits auf der Startseite geladene öffentliche
Bannerprojektion wiederverwendet; keine zusätzliche DB-/Signierungsabfrage.
Nur tatsächlich öffentlich lieferbare aktive Kampagnen qualifizieren einen
Bannerstandort, keine archivierten/abgelaufenen Kampagnen oder Legacy-Fallbacks.
Neue Kampagnen-IDs und neue Standorte gezielt prüfen und lokal ergänzen.
