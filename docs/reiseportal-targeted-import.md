# Gezielter Joomla-Import für Mottoreisen

Quelle: `.legacy-reiseportal/raw/articles.json`, `normalized/company-candidates.csv`, `normalized/company-media-references.csv` und `normalized/company-media-manifest.json`. Nur veröffentlichte Artikel (`state = 1`) werden berücksichtigt. Die Auswahl wurde vor dem Import festgelegt; bestehende Slugs bleiben unberührt.

| Joomla-ID | Profil | Belegter Themen-Tag | Warum ausgewählt | Medienbestand |
| --- | --- | --- | --- | --- |
| 458 | WIRODIVE Tauch- und Erlebnisreisen GmbH | Tauchurlaub (15) | Der Bereich hat noch keinen Anbieter; valide Kontaktdaten und Original-Logo vorhanden. | Logo ja; die vier Artikelbilder sind zeitgebundene Angebotsgrafiken, daher keine Galerie. |
| 468 | Wirthshof | Campingurlaub (17), Urlaub am Wasser (16) | Ein veröffentlichtes Profil deckt beide Lücken mit Standort am Bodensee ab. | Logo und unverfälschte Camping-/Unterkunftsfotos vorhanden. |
| 450 | Anni´s Romantikhäuschen in der Sächsische Schweiz | Romantik zu zweit (18), Wanderurlaub (12) | Veröffentlichtes, thematisch passendes Profil mit Kontakt und eigenen Bildern. | Logo und neun Hausbilder vorhanden. |
| 457 | Hotel zur Post | Geschäftsreisen (20) | Der Joomla-Text belegt Tagungsräume und Lage; Kontakt ist vollständig. | Logo und ein sauberes Zimmerfoto; weitere Artikelgrafiken enthalten eingebrannten Text. |
| 452 | 5* Golfurlaub Südtirol- Das Golfhotel Andreus | Golfurlaub (14), Wellnessangebote (19) | Das veröffentlichte Profil liegt laut Joomla-Text direkt am Golfplatz. | Logo und zahlreiche echte Hotel-/Golfplatzfotos. |

Die Texte und Kontaktdaten stammen aus diesen Artikeln beziehungsweise den exportierten Feldern. Leere Felder bleiben leer. Die Profile bekommen keinen erfundenen Auth-Owner und keine Energie-Gewerke. Der Import ist per Slug idempotent. Originalmedien werden als lokale Präsentationsdateien hinterlegt; spätere redaktionelle Uploads aus Supabase Storage haben Vorrang. Es werden keine Storage-Pfade oder privaten Bilddatensätze vorgetäuscht.

Die zwölf Mottoreisen-Kacheln entsprechen den publizierten Joomla-Bannern 172–183 aus `normalized/banner-inventory.csv`. Ihre Bildreferenzen waren im Export enthalten; die Binärdateien wurden von genau diesen Originalpfaden der bestehenden Joomla-Website übernommen. Die Themen-Tags selbst haben keine Beschreibung. Die Detailseiten verwenden kurze, wörtliche Auszüge aus publizierten Artikeln, deren IDs in `src/data/reiseportal-discovery.ts` stehen.
