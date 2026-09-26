-- Published Joomla articles and audit decisions: docs/reiseportal-legacy-inventory.json.
-- Batch 1/4, article IDs 506, 505, 504, 501, 500, 499, 498, 497, 496, 495, 494, 493.
-- Only absent slugs are inserted; existing profiles, owners, RLS and media tables stay untouched.
WITH source(joomla_id,slug,name,description,business_areas,street,postal_code,city,country,phone,public_email,website) AS (
  VALUES
    ('506', 'apartbauernhof-valrunzhof', 'Apartbauernhof Valrunzhof', 'Urlaubsglück am Valrunzhof - für die ganze Familie!

Du liebst komfortabel ausgestattete, liebevoll eingerichtete Apartments? Du schätzt eine familiäre Atmosphäre, ländliche Ruhe und die Nähe zur Natur? Dann freue dich auf unvergessliche Urlaubstage am Bauernhof Valrunzhof in Nauders am Reschenpass.

Unser Hof liegt im Dreiländereck zwischen Österreich, Italien und der Schweiz – ein idealer Ausgangspunkt für aktive und erholsame Tage in den Bergen. Wanderwege, die 2-Länder-Skiarena und der Einstieg in die Langlaufloipe befinden sich direkt in der Nähe. Zur Wahl stehen drei gemütliche Ferienwohnungen mit Südbalkon oder Terrasse, von denen aus du den herrlichen Panoramablick auf die beeindruckende Nauderer Bergwelt genießen kannst.', 'Familienurlaub', 'Nauders 491', '6543', 'Nauders', 'Österreich', '+43 5473 89092', 'info@valrunzhof.com', 'https://www.valrunzhof.com/'),
    ('505', 'hotel-ravelli-luxury-spa', 'Hotel Ravelli Luxury Spa', 'Im Ravelli Hotel, inmitten der wildromantischen Natur des Val di Sole, wollen wir jedem unserer Gäste außergewöhnliche Erlebnisse bieten.

Wir möchten sicher gehen, dass Sie Urlaub erleben, der maßgeschneidert ist auf Ihre Wünsche. Egal ob Sie sich nach einer Pause vom Alltag im neuen Adults-only-Spa oder dem großen Bergabenteuer sehnen. In unserem familiengeführten Hotel ist echte Gastfreundschaft der Schlüssel zu Ihrem Urlaubsglück. Besondere Erlebnisse im Hotel Trentino, Val di Sole! Your mountain getaway! Das persönliche Wohlgefühl ist auch eine Frage des Stils. Deshalb bieten wir im Trentino Unterkünfte für jeden Geschmack. Orte, die einladen zu bleiben. Die ihren ganz eigenen Charme versprühen. Die mit gemütlicher Atmosphäre locken. In unserer Auswahl an Zimmern und Suiten finden Sie liebevoll ausgewählte Details, die für individuellen Charakter sorgen. Die Sie dazu verleiten, an nichts zu denken und einfach den Moment zu genießen. Was alle Räume gemeinsam haben? Annehmlichkeiten, die für genussvollen Urlaub nötig sind sowie viele Inklusivleistungen .

Ravelli Spa at Ravelli Hotel', 'Wellnessangebote', 'Via IV Novembre 20', '38020', 'Mezzana', 'Italien', '+39 046 3757122', 'hotelravelli@ravellihotels.com', 'https://www.ravellihotels.com'),
    ('504', 'der-koenigsleitner-romantik-zu-zweit', 'Der Königsleitner - Romantik zu Zweit', 'Kinderfreies Hotel in Österreich - Am Waldrand, inmitten der Bergwelten des Nationalparks Hohe Tauern, liegt die Ruheoase DER KÖNIGSLEITNER.

Für Genießertypen und Ruhesucher - Lärmfreier Urlaub im Zillertal Wenn Sie an Urlaub denken, was fällt Ihnen dabei ein? Legen Sie Wert auf All-Inclusive-Action, Gästeabfertigung und Ultimaten zum günstigsten Preis?

Oder sind Sie eher der Genießertyp? Jemand der Genuss und Ruhe braucht, um das absolute Urlaubsglück zu finden? Suchen Sie nach Rundum-Erholung, Tiefenentspannung und wertvoller Zeit mit Freunden und Familie? Brauchen Sie dafür frische Luft, umgeben von atemberaubenden Naturkulissen, Bergwelten , Wäldern und Seen?', 'Romantik zu zweit', 'Königsleiten 181', '5742', 'Königsleiten', 'Österreich', '+43 6564 20290', 'urlaub@koenigsleiten.at', 'https://www.koenigsleiten.at'),
    ('501', 'wellnesshotel-almhof-call', 'Wellnesshotel Almhof Call', 'Ihr Urlaub in den Bergen! Im Almhof Call, Ihrem Wellnesshotel in St. Vigil am Kronplatz.

Genießen Sie die familiäre Atmosphäre unseres Wellnesshotels in St. Vigil in Enneberg direkt am Kronplatz. Die einladende Umgebung, die Entspannung, die eleganten Zimmer und Suiten, die ausgezeichnete Küche und die vielen Aktivitäten, die im Winter wie im Sommer auf Sie warten, sichern dem Hotel in den Dolomiten einen festen Platz in Ihrem Herzen. Als ständiger Begleiter beglücken Sie die herrlichen Umrisse der Dolomitengipfel, eine der eindrucksvollsten Naturkulissen der Erde.

1.200 m² für Ihr Wohlbefinden - Wellness am Kronplatz in den Dolomiten Der Wellness- und Therapy-Bereich des Almhofs Call, Ihrem Hotel mit Spa in den Dolomiten, ist eine authentische Wohlfühloase. In seinem Inneren bestimmen Sie ganz nach Ihrem Belieben. Gönnen Sie sich Zeit: für sich, zum Schwimmen in den Pools, für regenerierende Saunengänge, Massagen, verschiedene Behandlungen und Entspannung auf den Wasserbetten im Ruheraum. Eine Reise zu tiefstem Wohlbefinden und neuer Balance - Wellness am Kronplatz in den Dolomiten wirkt Wunder!', 'Wanderurlaub, Wellnessangebote', 'Plazores Strasse 8', '39030', 'St. Vigil in Enneberg Dolomiten', 'Italien', '+39 0474 501043', 'info@almhof-call.com', 'https://www.almhof-call.com/'),
    ('500', 'rhoen-park-aktiv-resort', 'RHÖN PARK AKTIV RESORT', 'Unser beliebtes Tagungshotel liegt auf 750 Höhenmetern mitten im UNESCO Biosphärenreservat Bayerische Rhön im Dreiländereck Bayern, Hessen, Thüringen.', 'Geschäftsreisen, Natur pur, Wanderurlaub, Radwandern, Nordic Walking', 'Rother Kuppe 2', '97647', 'Hausen-Roth', 'Deutschland', '+49 9779 910', NULL, NULL),
    ('499', 'mintrops-land-hotel', 'Mintrops Land Hotel', 'Das Mintrops Land Hotel in Burgaltendorf ist ein 4-Sterne-Hotel mit individuell gestalteten Designer-Zimmern und einer wahren Liebe zum Detail.', 'Geschäftsreisen, Familienurlaub, Wellnessangebote', 'Schwarzensteinweg 81', '45289', 'Essen', 'Deutschland', '+49 201 57171-0', NULL, NULL),
    ('498', 'landgut-ramshof', 'Landgut Ramshof', 'Unser Hotel verfügt über 56 sehr komfortable Zimmer, von klassisch bis modern, sowie eine wunderschöne Hochzeits-Suite.', 'Geschäftsreisen', 'Ramshof 1', '47877', 'Willich', 'Deutschland', '+49 2156 – 95890', NULL, NULL),
    ('497', 'pletzer-resorts-bayrischzell', 'Pletzer Resorts Bayrischzell', 'Ob der Berg ruft oder der See – wir haben die perfekte Antwort. In faszinierenden Destinationen in Österreich und im bayerischen Alpenraum bieten wir Ihnen erholsame und bewegende Urlaubstage.', 'Geschäftsreisen, Familienurlaub, Wellnessangebote, Wanderurlaub, Radwandern, Natur pur, Nordic Walking', 'Kranzerstraße 6', '83735', 'Bayrischzell', 'Deutschland', '+49 8023 8194 600', NULL, NULL),
    ('496', 'lindner-hotel-koeln-city-plaza', 'Lindner Hotel Köln City Plaza', 'Modernste Technik, professionelle Dienstleistungen und eine reibungslose Organisation sorgen dafür, dass Sie sich voll und ganz auf Ihr Geschäft konzentrieren können.', 'Geschäftsreisen', 'Magnusstrasse 20', '50672', 'Köln', 'Deutschland', '+49 221 2034 0', NULL, NULL),
    ('495', 'schlosshotel-ralswiek', 'Schlosshotel Ralswiek', 'Privilegiert gelegen in traumhaft schöner Lage am Großen Jasmunder Bodden, empfängt Sie das Schlosshotel in seiner historischen Atmosphäre.', 'Natur pur, Radwandern, Wanderurlaub, Familienurlaub, Urlaub am Wasser, Geschäftsreisen, Romantik zu zweit', 'Parkstraße 3', '18528', 'Ralswiek', 'Deutschland', '+49 3838-20320', NULL, NULL),
    ('494', 'hotel-godewind', 'Hotel GODEWIND', 'Das Meer von drei Seiten, ein endloser Sandstrand, eine unverwechselbare Natur und immer eine frische Brise um die Nase – das alles finden Sie im Hotel Godewind im Ostseebad Thiessow auf der Insel Rügen.', 'Natur pur, Radwandern, Wanderurlaub, Urlaub am Wasser, Familienurlaub', 'De niege Wech 7', '18586', 'Mönchgut', 'Deutschland', '+49 (0)38308 – 34 20', NULL, NULL),
    ('493', 'oewers-wellness-und-spa-hotel', 'OEWERS Wellness & Spa Hotel', 'Inmitten einer wunderschönen Landschaft, die der Seele gut tut, mit grünen Wäldern, duftenden Wiesen und Feldern auf der sonnenverwöhnten.', 'Natur pur, Radwandern, Wanderurlaub, Wellnessangebote, Urlaub am Wasser', 'WILHELMSTRASSE 34', '18586', 'OSTSEEBAD SELLIN', 'Deutschland', '+49 38303 122 – 0', NULL, NULL)
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
    ('apartbauernhof-valrunzhof', 'theme:familienurlaub'),
    ('apartbauernhof-valrunzhof', 'audience:familie'),
    ('hotel-ravelli-luxury-spa', 'theme:wellnessangebote'),
    ('hotel-ravelli-luxury-spa', 'accommodation:hotel'),
    ('der-koenigsleitner-romantik-zu-zweit', 'theme:romantik-zu-zweit'),
    ('der-koenigsleitner-romantik-zu-zweit', 'audience:paar'),
    ('wellnesshotel-almhof-call', 'theme:wanderurlaub'),
    ('wellnesshotel-almhof-call', 'theme:wellnessangebote'),
    ('wellnesshotel-almhof-call', 'accommodation:hotel'),
    ('rhoen-park-aktiv-resort', 'theme:geschaeftsreisen'),
    ('rhoen-park-aktiv-resort', 'theme:natur-pur'),
    ('rhoen-park-aktiv-resort', 'theme:wanderurlaub'),
    ('rhoen-park-aktiv-resort', 'theme:radwandern'),
    ('rhoen-park-aktiv-resort', 'theme:nordic-walking'),
    ('mintrops-land-hotel', 'theme:geschaeftsreisen'),
    ('mintrops-land-hotel', 'theme:familienurlaub'),
    ('mintrops-land-hotel', 'theme:wellnessangebote'),
    ('mintrops-land-hotel', 'audience:familie'),
    ('mintrops-land-hotel', 'accommodation:hotel'),
    ('landgut-ramshof', 'theme:geschaeftsreisen'),
    ('pletzer-resorts-bayrischzell', 'theme:geschaeftsreisen'),
    ('pletzer-resorts-bayrischzell', 'theme:familienurlaub'),
    ('pletzer-resorts-bayrischzell', 'theme:wellnessangebote'),
    ('pletzer-resorts-bayrischzell', 'theme:wanderurlaub'),
    ('pletzer-resorts-bayrischzell', 'theme:radwandern'),
    ('pletzer-resorts-bayrischzell', 'theme:natur-pur'),
    ('pletzer-resorts-bayrischzell', 'theme:nordic-walking'),
    ('pletzer-resorts-bayrischzell', 'audience:familie'),
    ('lindner-hotel-koeln-city-plaza', 'theme:geschaeftsreisen'),
    ('lindner-hotel-koeln-city-plaza', 'accommodation:hotel'),
    ('schlosshotel-ralswiek', 'theme:natur-pur'),
    ('schlosshotel-ralswiek', 'theme:radwandern'),
    ('schlosshotel-ralswiek', 'theme:wanderurlaub'),
    ('schlosshotel-ralswiek', 'theme:familienurlaub'),
    ('schlosshotel-ralswiek', 'theme:urlaub-am-wasser'),
    ('schlosshotel-ralswiek', 'theme:geschaeftsreisen'),
    ('schlosshotel-ralswiek', 'theme:romantik-zu-zweit'),
    ('schlosshotel-ralswiek', 'audience:familie'),
    ('schlosshotel-ralswiek', 'audience:paar'),
    ('schlosshotel-ralswiek', 'accommodation:hotel'),
    ('hotel-godewind', 'theme:natur-pur'),
    ('hotel-godewind', 'theme:radwandern'),
    ('hotel-godewind', 'theme:wanderurlaub'),
    ('hotel-godewind', 'theme:urlaub-am-wasser'),
    ('hotel-godewind', 'theme:familienurlaub'),
    ('hotel-godewind', 'audience:familie'),
    ('hotel-godewind', 'accommodation:hotel'),
    ('oewers-wellness-und-spa-hotel', 'theme:natur-pur'),
    ('oewers-wellness-und-spa-hotel', 'theme:radwandern'),
    ('oewers-wellness-und-spa-hotel', 'theme:wanderurlaub'),
    ('oewers-wellness-und-spa-hotel', 'theme:wellnessangebote'),
    ('oewers-wellness-und-spa-hotel', 'theme:urlaub-am-wasser'),
    ('oewers-wellness-und-spa-hotel', 'accommodation:hotel')
) AS tagged(slug,term_key) ON tagged.slug=p.slug
JOIN public.travel_terms t ON t.term_key=tagged.term_key
ON CONFLICT (profile_id,term_key) DO NOTHING;
