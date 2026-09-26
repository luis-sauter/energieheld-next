# Reiseportal-Taxonomie: Quellenprüfung

Stand: Joomla-Export `.legacy-reiseportal/raw/articles.json` und `.legacy-reiseportal/raw/article-fields.json`, geprüft gegen die zehn bereits importierten Reiseprofile. Die Artikel-ID bezeichnet den Originaldatensatz. Nur sichere Zuordnungen stehen in der Migration.

| Profil | Dimension | Term | Joomla-Quelle | Konkretes Feld / Datensatz | Bewertung |
| --- | --- | --- | --- | --- | --- |
| Höflehner | audience | Familie | `raw/articles.json` | Artikel 464, `attributes.tags[13] = Familienurlaub` und `attributes.category-bd.Familienurlaub` | sicher |
| Anni´s Romantikhäuschen | audience | Paar | `raw/articles.json` | Artikel 450, `attributes.tags[18] = Romantik zu zweit` und `attributes.category-bd["Romantik zu zweit"]` | sicher |
| Pension Sonnenhof | accommodation | Pension | `raw/articles.json` | Artikel 470, `attributes.title = Pension Sonnenhof` | sicher |
| Hotel zur Post | accommodation | Hotel | `raw/articles.json` | Artikel 457, `attributes.title = Hotel zur Post` | sicher |
| Golfhotel Andreus | accommodation | Hotel | `raw/articles.json` | Artikel 452, `attributes.title` nennt ausdrücklich „Golfhotel Andreus“ | sicher |

Die 27 Joomla-Custom-Field-Definitionen enthalten kein Feld für Ausstattung oder Merkmale. Die vorhandenen Tags und `category-bd`-Werte benennen Reiseziele beziehungsweise Reisethemen, keine Ausstattung. Daher gibt es **keine** belegten Feature-Terme oder Feature-Zuordnungen. Auch `Mit Hund` und `Gruppe` sind für keines der zehn Profile strukturiert belegt.

Bewusst ausgelassen: Die Themen-Tags `Campingurlaub` bei Wirthshof und `Wellnessangebote` bei Höflehner/Golfhotel Andreus belegen ein Reisethema, aber weder eindeutig einen Unterkunftstyp noch eine konkrete Ausstattung. Der separate Joomla-Artikel 486 heißt „Natur- und Wellnesshotel Höflehner“; er wird nicht automatisch mit dem importierten Artikel 464 gleichgesetzt. Anbieter- und Beschreibungstexte wurden nicht zur Merkmalsableitung verwendet. Demo GmbH erhält keine Zuordnung.
