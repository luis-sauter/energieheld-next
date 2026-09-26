-- Five published Joomla articles selected and documented in
-- docs/reiseportal-targeted-import.md. No synthetic Auth owner, energy trade,
-- Storage object or media row is created. Re-running cannot duplicate slugs.
WITH source(slug, name, tagline, description, business_areas, street,
  postal_code, city, country, phone, public_email, website) AS (
  VALUES
    (
      'wirodive-tauchreisen', 'WIRODIVE Tauch- und Erlebnisreisen GmbH',
      'Tauchreisen, Tauchsafaris und Abenteuerurlaube weltweit!',
      'Alles Gute für Ihren gelungenen Tauchurlaub! Hier finden Sie die Kur für Ihr Meer- und Fernweh! Entdecken Sie die schönsten Tauchreisen, Tauchsafaris und Abenteuerreiseziele weltweit.',
      'Tauchurlaub', 'Egerlandstr. 30', '85368', 'Moosburg/Isar', 'Deutschland',
      '+49 (0) 8761 724 8000', 'info@wirodive.de', 'https://wirodive.de/'
    ),
    (
      'wirthshof', 'Wirthshof',
      'BODENSEE-CAMPING: FÜR KINDER, GENIESSER UND AKTIVURLAUBER',
      'Im Urlaub einen Gang herunterschalten und genau das tun, was ich will – das ist Bodensee-Camping bei uns auf dem Wirthshof. Mit der Familie die Bodenseeregion erkunden, die Natur entdecken, im Wald einen verborgenen Schatz finden oder einfach nur Nichtstun und sich erholen. Ob mit dem eigenen Caravan oder Wohnmobil, in einem unserer komfortablen Mobilheime oder klassisch im Zelt.',
      'Campingurlaub, Urlaub am Wasser', 'Steibensteg 4', '88677', 'Markdorf', 'Deutschland',
      '+49 (0) 7544 9627-0', 'post@wirthshof.de', 'https://www.wirthshof.de/'
    ),
    (
      'anni-romantikhaeuschen', 'Anni´s Romantikhäuschen in der Sächsische Schweiz',
      'Hier geht Ihnen im wahrsten Sinne das Herz auf.',
      'Romantik - Kurzreisen als Kuschelwochenende zählt zu den besonderen Erlebnissen für Verliebte! Abseits vom Alltag - die Zeit zu Zweit genießen. Mit liebevollen, romantischen Arrangements und Details ermöglicht Ihnen Anni´s Romantik-Angebot traute Zweisamkeit in absoluter Privatsphäre.',
      'Romantik zu zweit, Wanderurlaub', 'Am Königstein 4', '01824', 'Königstein', 'Deutschland',
      '035021/99965', 'annis-romantikhaeuschen@freenet.de', 'http://www.annis-romantikhaeuschen.de/'
    ),
    (
      'hotel-zur-post', 'Hotel zur Post',
      'In unserem Tagungshotel in Bayern gibt es drei helle Tagungsräume mit Platz für insgesamt bis zu 95 Personen und modernster technischer Ausstattung.',
      'Das Hotel Zur Post liegt in idyllischer Lage zwischen München und Salzburg, jeweils nur eine Autostunde entfernt und einfach zu erreichen. Der ideale Ort für Ihre Tagung in Bayern nahe München, Salzburg oder Passau. In diesem charmanten Ambiente lässt es sich nicht nur herrlich tagen, sondern auch übernachten: dazu laden 75 Zimmer mit Wohlfühlcharakter ein.',
      'Geschäftsreisen', 'Kapellplatz 2', '84503', 'Altötting', 'Deutschland',
      '+49 (0) 8671/97337-0', 'info@hotelzurpost-altoetting.de', 'https://hotelzurpost-altoetting.de/'
    ),
    (
      'golfhotel-andreus', '5* Golfurlaub Südtirol- Das Golfhotel Andreus',
      'Golf in Südtirol auf der Sonnenseite der Alpen.',
      'Das Golf & Spa Resort Hotel Andreus liegt direkt am traumhaft gelegenen 18-Loch Golfplatz Passeier. Meran. Diese Einmaligkeit des Hotels direkt am Golfplatz zu liegen gibt es nur ein einziges Mal in Südtirol. Die Lage des Golfhotels Südtirol Andreus, direkt an der 18-Loch Golfanlage in Südtirol, ist die Mega Chance für jeden Golfer direkt los zu legen.',
      'Golfurlaub, Wellnessangebote', 'Kellerlahne 3a', '39015', 'St. Leonhard i. Pass.', 'Italien',
      '+39 / 0473 49 13 30', 'info@andreus.it', 'http://www.andreus.it/'
    )
), new_companies AS (
  INSERT INTO public.companies (owner_user_id, legal_name, contact_email)
  SELECT NULL, s.name, s.public_email FROM source s
  WHERE NOT EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.slug = s.slug)
  RETURNING id, legal_name
)
INSERT INTO public.company_profiles
  (company_id, slug, display_name, tagline, description, business_areas,
    street, postal_code, city, region, country, phone, public_email, website,
    status, approved_at)
SELECT c.id, s.slug, s.name, s.tagline, s.description, s.business_areas,
  s.street, s.postal_code, s.city, NULL, s.country, s.phone, s.public_email,
  s.website, 'approved', now()
FROM source s JOIN new_companies c ON c.legal_name = s.name;
