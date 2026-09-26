-- Published Joomla articles and audit decisions: docs/reiseportal-legacy-inventory.json.
-- Batch 4/4, article IDs 459, 456, 453, 451, 449, 448, 447, 446, 442.
-- Only absent slugs are inserted; existing profiles, owners, RLS and media tables stay untouched.
WITH source(joomla_id,slug,name,description,business_areas,street,postal_code,city,country,phone,public_email,website) AS (
  VALUES
    ('459', 'sub-aqua-tauchreisen', 'SUB Aqua Tauchreisen', 'Buchen Sie Ihren Tauchurlaub beim Spezialisten für besondere Tauchreisen!

Hier finden Sie die Kur für Ihr Meer- und Fernweh! Entdecken Sie die schönsten Tauchreisen, Tauchsafaris und Abenteuerreiseziele weltweit.

Vom entspannten Einsteiger-Erlebnis bis zur spektakulären Tauchsafari , vom Familien-Tauchspaß bis zum Bambus-Chalet mit Privatstrand – seit 1972 ist SUB AQUA für Sie an den schönsten Spots der Welt zuhause.', 'Tauchurlaub', 'Franz-Joseph-Str. 43', '80801', 'München', 'Deutschland', '+49 (0) 89 20 80 76-135', NULL, 'https://www.sub-aqua.de/'),
    ('456', 'platzl-hotel', 'Platzl Hotel', 'Ihr Tagungshotel in München - TAGEN UND FEIERN SIE DORT WO MÜNCHENS HERZ SCHLÄGT!

Im Jahr 2015 haben wir im Platzl Hotel unseren gesamten Tagungsbereich neu gestaltet. Das Ergebnis ist eine unvergleichliche Wohlfühl- und Arbeitsatmosphäre im Herzen von München! Alle Tagungsräume sind mit modernster Technik ausgestattet und haben dank natürlicher Qualitätsmaterialien die charakteristische Platzl-Note bewahrt. Beeindrucken Sie Ihre Gäste in Räumlichkeiten, die ein traditionelles aber modernes sowie funktionelles Ambiente bieten: Der perfekte Rahmen für geschäftliche Treffen oder feierliche Anlässe mit höchsten Ansprüchen. Trotz der Lage unseres Tagungshotels im Zentrum von München bieten wir komfortable Anreise- und Parkmöglichkeiten für Gäste mit Auto.

Seminare und Meetings im PLATZL HOTEL München Wussten Sie, dass wir in unserem Tagungshotel auch über Seminarräume für Veranstaltungen im kleinen Rahmen verfügen? Die Tagungsräume Schmid-Wildy und die Bäcker-Stube bieten Platz für 10 oder weniger Personen.', 'Geschäftsreisen', 'Sparkassenstraße 10', '80331', 'München', 'Deutschland', '+49(0)89 237030', 'servus@platzl.de', 'https://www.platzl.de/'),
    ('453', 'oversum-vital-resort-im-hochsauerland', 'OVERSUM Vital Resort im Hochsauerland', 'Nicht einfach nur ein Hotel ist das im Mai 2012 neu eröffnete OVERSUM Vital Resort im Hochsauerland, nahe den großen Zentren wie Düsseldorf und Köln. OVERSUM (lat. „Ovum“ und „Universum“) ist ein kosmopolitisches Hotel-Universum der Extraklasse auf 13.000 qm.

OVERSUM ist die neue Landmarke von Winterberg. OVERSUM ist das wohl erste Hotel-Ei Europas: Einzigartig das Zusammenspiel architektonischer Elemente, exzellent und exklusiv das Ambiente. OVERSUM gibt ein tief geborgenes Gefühl und individuelle Freiheit. OVERSUM lebt durch ein junges, motiviertes Team. OVERSUM ist ein Gefühl, eine Lebensart. OVERSUM ist Energie.

Wohn VERSUM Wände in Weiß und einem warmen Cappuccino-Ton, Akzente in dunklem Braun und Rot: Die Farbwelten der 77 OVERSUM-Zimmer stehen für trendige Eleganz. Aus riesigen Fenster-fronten schweift der Blick über die tausend Berge im Sauerland, dazwischen Schieferdächer und Baumkronen.', 'Natur pur, Wanderurlaub, Geschäftsreisen', 'Am Kurpark 6', '59955', 'Winterberg', 'Deutschland', '+49(0)2981-929550', 'info@oversum-vitalresort.de', 'https://www.oversum-vitalresort.de'),
    ('451', 'das-5-sterne-wellness-hotel-stock-resort', 'Das 5-Sterne-Wellness-Hotel STOCK resort', 'Wellnessurlaub im Hotel STOCK resort in Tirol, mit Wellnessangeboten der Spitzenklasse.

Das 5-Sterne Wellnesshotel bietet über die Privilegien eines 5 Sterne Hotels hinaus pures Wohlbefinden für alle Sinne.

Perfekte Voraussetzungen für unvergessliche Urlaubstage inmitten einer atemberaubenden Bergkulisse.', 'Wanderurlaub, Familienurlaub, Wellnessangebote', 'Dorf 142', '6292', 'Finkenberg Zillertal', 'Österreich', '+43.5285.6775 422', 'urlaub@stock.at', 'http://www.stock.at/'),
    ('449', 'ostsee-barfusspark', 'OSTSEE - BARFUSSpark', 'Ferien, Spass & Urlaub an der Ostsee! Zu jeder Jahreszeit – Frühling, Sommer, Herbst & Winter. Ferien an der Ostsee!

Die Ferienwohnungen bieten euch allen Komfort: gemütlich eingerichteter Wohnraum, Sat-TV, Radio, komplett ausgestattete Küchenzeile, Essecke, separate(s) Schlafzimmer, Kinderbettchen und Hochstuhl auf Wunsch.

Ps: Auf dem Ferienhof sind eure Vierbeiner nicht nur erlaubt, sie sind herzlich willkommen! Mit Urlaub für die ganze Familie, ist eben auch die ganze Familie gemeint.', 'Familienurlaub, Urlaub am Wasser', 'Schwackendorf 37', '24376', 'Hasselberg', 'Deutschland', '0 46 42 / 96 51 78', 'info@barfusspark-schwackendorf.de', 'http://www.barfusspark-schwackendorf.de/'),
    ('448', 'urlaub-auf-borkum', 'Urlaub auf Borkum', 'Willkommen auf der beliebten Ferieninsel Borkum.

Willkommen im Hotel Villa Weststrand . Flanieren Sie in der beliebten Einkaufsstraße in den Geschäften und erkunden Sie die traumhafte Umgebung.

Die Nordseeinsel mit Hochseeklima verspricht Durchatmen auf höchstem Niveau. Mit rund 30 Kilometern Entfernung zur deutschen Küste hat Borkum nicht nur einen wunderbaren Abstand zum Alltag. Es liegt auch als einzige ostfriesische Insel ganzjährig unter Einfluss von Hochseeklima.', 'Familienurlaub, Urlaub am Wasser', 'Bismarckstraße 38', '26757', 'Borkum', 'Deutschland', '04922 / 9397-0', 'info@villa-weststrand.de', 'http://www.villa-weststrand.de/'),
    ('447', 'city-apart-dresden', 'City Apart Dresden', 'Erleben Sie Kultur, mitten im Herzen von Dresden!

Unsere FeWo´s sind ideal für Familien oder Paare. Die perfekte Alternative zum Hotel.

Alle Sehenswürdigkeiten wie Frauenkirche , Semperoper , Brühlsche Terrasse , Kreuzkirche , Dresdner Zwinger , Hausmannsturm , katholische Hofkirche sowie die Anlegestelle der Sächsischen Dampfschiff-Fahrt liegen direkt vor der Haustür.Sie können alles bequem zu Fuß erreichen.', 'Romantik zu zweit, Geschäftsreisen', 'Orangeriestr. 7', '01326', 'Dresden', 'Deutschland', '+49 (0) 351 315 542 1', 'kontakt@city-apart-dresden.de', 'http://www.city-apart-dresden.de/'),
    ('446', 'ferienwohnung-sieber', 'Ferienwohnung Sieber', 'Komfortabel und gemütlich eingerichtete App. in Langenargen am Bodensee.

Seit 1963 ist unser Appartementhaus im Familienbesitz, zahlreiche Stammgäste zeichnen uns aus. Viele Jahre sind wir, Edgar & Dagmar Sieber mit Herz und Seele dabei und geben unsere Gastfreundlichkeit zum Besten!Leben Sie bei uns frei nach dem Motto:"In der Ruhe liegt die Kraft". Wir würden uns freuen, Sie bald als liebe Gäste bei uns begrüßen zu dürfen!

Liebevoll ausgestattete Appartements, bestehend aus einem großzügigen Wohnraum mit bequemer Schlafcouch und Tisch, einer gemütlichen Essecke mit gepolsterten Stühlen und einer komplett eingerichteten Küche oder Kochnische sind die Perlen unseres Appartementhauses. Die Einrichtung lässt keine Wünsche offen: 42 Zoll Panasonic Plasma Flachbild TV der Luxusklasse mit ca. 70 deutschen und 50 ausländischen Sendern in fantastischer Full HD Qualität was für einen erstklassigen Heimkino Genuss sorgt sowie ca. 120 Radiosender - Stereo-Radiowecker, gratis. Breitband Internetzugang und Küchen mit Kaffeemaschine, Toaster, Wasser- und Eierkocher sowie Mikrowelle.', 'Natur pur, Urlaub am Wasser', 'Untere Seestrasse 28', '88085', 'Langenargen', 'Deutschland', '+49 7543 / 2657', 'urlaub@fewo-sieber.de', 'http://www.fewo-sieber.de/'),
    ('442', 'landgasthof-neue-schaenke', 'Landgasthof "Neue Schänke"', 'Landgasthof „Neue Schänke“ in der sächsischen Schweiz.

Im Elbsandsteingebirge, auch bekannt als Sächsische Schweiz, nahe der weltberühmten Kunst-, Kultur- und Landeshauptstadt Dresden, inmitten einer durch romantische Täler, mächtige Tafelberge und bizarre Sandsteinfelsen geprägten Landschaft findet man Königstein an der Elbe.

Wahrzeichen des Ortes ist die gleichnamige Festung - Besuchermagnet und Herzstück eines Museumskomplexes, welcher in besonderer Weise einen Teil der sächsischen Geschichte darstellt.', 'Natur pur, Wanderurlaub', 'Am Königstein 3', '01824', 'Königstein / Sächsische Schweiz', 'Deutschland', '035021 - 9 99 60', 'NeueSchaenke@t-online.de', 'http://www.neue-schaenke.de')
), new_companies AS (
  INSERT INTO public.companies(owner_user_id,legal_name,contact_email)
  SELECT NULL,s.name,s.public_email FROM source s
  WHERE NOT EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.slug=s.slug)
  RETURNING id,legal_name
), new_profiles AS (
  INSERT INTO public.company_profiles(company_id,slug,display_name,description,business_areas,street,postal_code,city,country,phone,public_email,website,status,approved_at)
  SELECT c.id,s.slug,s.name,s.description,s.business_areas,s.street,s.postal_code,s.city,s.country,s.phone,s.public_email,s.website,'approved',now()
  FROM source s JOIN new_companies c ON c.legal_name=s.name
  RETURNING id,slug
)
INSERT INTO public.company_profile_travel_terms(profile_id,term_key)
SELECT p.id,t.term_key FROM new_profiles p
JOIN (VALUES
    ('sub-aqua-tauchreisen', 'theme:tauchurlaub'),
    ('platzl-hotel', 'theme:geschaeftsreisen'),
    ('platzl-hotel', 'accommodation:hotel'),
    ('oversum-vital-resort-im-hochsauerland', 'theme:natur-pur'),
    ('oversum-vital-resort-im-hochsauerland', 'theme:wanderurlaub'),
    ('oversum-vital-resort-im-hochsauerland', 'theme:geschaeftsreisen'),
    ('das-5-sterne-wellness-hotel-stock-resort', 'theme:wanderurlaub'),
    ('das-5-sterne-wellness-hotel-stock-resort', 'theme:familienurlaub'),
    ('das-5-sterne-wellness-hotel-stock-resort', 'theme:wellnessangebote'),
    ('das-5-sterne-wellness-hotel-stock-resort', 'audience:familie'),
    ('das-5-sterne-wellness-hotel-stock-resort', 'accommodation:hotel'),
    ('ostsee-barfusspark', 'theme:familienurlaub'),
    ('ostsee-barfusspark', 'theme:urlaub-am-wasser'),
    ('ostsee-barfusspark', 'audience:familie'),
    ('urlaub-auf-borkum', 'theme:familienurlaub'),
    ('urlaub-auf-borkum', 'theme:urlaub-am-wasser'),
    ('urlaub-auf-borkum', 'audience:familie'),
    ('city-apart-dresden', 'theme:romantik-zu-zweit'),
    ('city-apart-dresden', 'theme:geschaeftsreisen'),
    ('city-apart-dresden', 'audience:paar'),
    ('ferienwohnung-sieber', 'theme:natur-pur'),
    ('ferienwohnung-sieber', 'theme:urlaub-am-wasser'),
    ('ferienwohnung-sieber', 'accommodation:ferienwohnung'),
    ('landgasthof-neue-schaenke', 'theme:natur-pur'),
    ('landgasthof-neue-schaenke', 'theme:wanderurlaub')
) AS tagged(slug,term_key) ON tagged.slug=p.slug
JOIN public.travel_terms t ON t.term_key=tagged.term_key
ON CONFLICT (profile_id,term_key) DO NOTHING;
