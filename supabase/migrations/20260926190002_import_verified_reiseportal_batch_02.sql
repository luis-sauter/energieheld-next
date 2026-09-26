-- Published Joomla articles and audit decisions: docs/reiseportal-legacy-inventory.json.
-- Batch 2/4, article IDs 492, 491, 490, 489, 488, 487, 485, 484, 483, 482, 481, 479.
-- Only absent slugs are inserted; existing profiles, owners, RLS and media tables stay untouched.
WITH source(joomla_id,slug,name,description,business_areas,street,postal_code,city,country,phone,public_email,website) AS (
  VALUES
    ('492', 'landhotel-talblick', 'Landhotel Talblick ****', 'Inmitten einer wunderschönen Landschaft, die der Seele gut tut, mit grünen Wäldern, duftenden Wiesen und Feldern auf der sonnenverwöhnten.', 'Natur pur, Radwandern, Wanderurlaub, Wellnessangebote', 'Breitenbergerstraße 15', '75389', 'Neuweiler-Oberkollwangen', 'Deutschland', '+49 7055-92880', NULL, NULL),
    ('491', 'laerchenhof', 'Lärchenhof', 'Urlaub in Tirol heißt ankommen, mit Freunden Zeit verbringen, die Kraft der Natur und ehrliche Gastfreundschaft spüren.', 'Natur pur, Radwandern, Wanderurlaub, Familienurlaub, Wellnessangebote', 'Holzleiten 86', '6416', 'Obsteig', 'Österreich', '+43 (0)5264 8234', NULL, NULL),
    ('490', 'haus-terra-ferienwohnung', 'Haus Terra - Ferienwohnung', 'Die unberührte Natur am Waldrand lädt zum Erholen und Genießen für Naturliebhaber und Sportsuchende ein.', 'Natur pur, Radwandern, Wanderurlaub', 'Vorberg 188', '8973', 'Schladming', 'Österreich', '+43 664 2525181', NULL, NULL),
    ('489', 'hotel-mondschein', 'Hotel Mondschein', 'MEHR ALS EIN HOTEL: VIER GEMÜTLICHE RÜCKZUGSORTEN AM ARLBERG', 'Natur pur, Radwandern, Wanderurlaub', 'Hannes-Schneider-Promenade 9', '6762', 'Stuben am Arlberg', 'Österreich', '+43 5582 511', NULL, NULL),
    ('488', 'feelfree-nature-resort', 'FEELFREE NATURE RESORT', 'In unserem einzigartigen Resort ist der Urlaub erfrischend anders, unglaublich vielfältig und einfach. Warum? Weil wir selber so sind. Und weil wir das Leben so mögen.', 'Natur pur, Radwandern, Wanderurlaub, Familienurlaub, Wellnessangebote', 'Piburger Straße 6', '6433', 'Oetz', 'Österreich', '+43 5252 20248', NULL, NULL),
    ('487', 'alpenhotel-montafon', 'Alpenhotel Montafon', 'Gönnen Sie sich ausgiebigen Urlaubsgenuss, wertvolle Zeit für sich selbst und schöne Erlebnisse mit Ihren Liebsten.', 'Natur pur, Wanderurlaub, Familienurlaub, Wellnessangebote, Geschäftsreisen, Radwandern', 'Silvrettastraße 175', '6780', 'Schruns im Montafon', 'Österreich', '+43 5556 75700', NULL, NULL),
    ('485', 'kesselgrub', 'Kesselgrub', 'Familienzeit leicht gemacht. WER WILL GLÜCKLICHE FAMILIEN SEHEN? DER MUSS INS KESSELGRUB GEHEN!', 'Natur pur, Wanderurlaub, Familienurlaub, Wellnessangebote', 'Lackengasse 1', '5541', 'Salzburg Altenmarkt im Pongau', 'Österreich', '+43 6452/5232', NULL, NULL),
    ('484', 'small-und-beautiful-hotel-gnaid', 'Small & Beautiful Hotel Gnaid', 'Am Panoramahügel Dorf Tirol thront das Hotel Gnaid mit Blick in südwestliche Richtung auf die Texelgruppe, über das Etschtal und hinauf in den Vinschgau.', 'Natur pur, Radwandern, Wanderurlaub, Wellnessangebote, Golfurlaub', 'Gnaidweg 5', '39019', 'Dorf Tirol', 'Italien', '+39 0473 923 412', NULL, NULL),
    ('483', 'golf-und-sporthotel-hof-maran', 'GOLF- & SPORTHOTEL HOF MARAN', 'Freuen Sie sich auch so auf den Sommer in Arosa? Auf blühende Bergwiesen, kristallklare Bergseen, auf Murmeltiere, Eichhörnli und die Bären im benachbarten Bärenland.', 'Natur pur, Nordic Walking, Radwandern, Wanderurlaub, Golfurlaub, Familienurlaub', 'Maranerstrasse 66', '7050', 'Arosa', 'Schweiz', '+41 81 378 51 51', NULL, NULL),
    ('482', 'wellnesshotel-golfpanorama', 'Wellnesshotel Golfpanorama', 'Beginnen Sie den Tag mit einem herrlichen Frühstück, geniessen Sie den Wellnessbereich oder erleben Sie mit dem Velo oder auf Wanderwegen den herrlichen Kanton Thurgau', 'Natur pur, Wellnessangebote, Golfurlaub, Geschäftsreisen, Wanderurlaub, Radwandern, Nordic Walking', 'Golfpanorama 6', '8564', 'Lipperswil', 'Schweiz', '+41 52 208 08 08', NULL, NULL),
    ('481', 'kaiser-hans-natur-residence', 'Kaiser Hans - Natur Residence', 'Freuen Sie sich auf die modernen und gemütlich eingerichteten Suiten und Apartments mit unvergleichlichem Ausblick!', 'Natur pur, Radwandern, Wanderurlaub', 'Verdins Dorf 31', '39017', 'Schenna', 'Italien', '+39 0473 868 156', NULL, NULL),
    ('479', 'pension-steingarten', 'Pension Steingarten', 'Idealer Aufenthaltsort für Ihren Urlaub. Die Montiggler Seen sowie der Kalterer See sind in kürzester Zeit erreichbar. Günstiger Ausgangspunkt für Tagesausflüge in die Dolomiten, zum Gardasee und nach Venedig.', 'Natur pur, Radwandern, Wanderurlaub', 'Rittsteinweg 67', '39057', 'Eppan', 'Italien', '+39 0471 66 46 66', NULL, NULL)
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
    ('landhotel-talblick', 'theme:natur-pur'),
    ('landhotel-talblick', 'theme:radwandern'),
    ('landhotel-talblick', 'theme:wanderurlaub'),
    ('landhotel-talblick', 'theme:wellnessangebote'),
    ('landhotel-talblick', 'accommodation:hotel'),
    ('laerchenhof', 'theme:natur-pur'),
    ('laerchenhof', 'theme:radwandern'),
    ('laerchenhof', 'theme:wanderurlaub'),
    ('laerchenhof', 'theme:familienurlaub'),
    ('laerchenhof', 'theme:wellnessangebote'),
    ('laerchenhof', 'audience:familie'),
    ('haus-terra-ferienwohnung', 'theme:natur-pur'),
    ('haus-terra-ferienwohnung', 'theme:radwandern'),
    ('haus-terra-ferienwohnung', 'theme:wanderurlaub'),
    ('haus-terra-ferienwohnung', 'accommodation:ferienwohnung'),
    ('hotel-mondschein', 'theme:natur-pur'),
    ('hotel-mondschein', 'theme:radwandern'),
    ('hotel-mondschein', 'theme:wanderurlaub'),
    ('hotel-mondschein', 'accommodation:hotel'),
    ('feelfree-nature-resort', 'theme:natur-pur'),
    ('feelfree-nature-resort', 'theme:radwandern'),
    ('feelfree-nature-resort', 'theme:wanderurlaub'),
    ('feelfree-nature-resort', 'theme:familienurlaub'),
    ('feelfree-nature-resort', 'theme:wellnessangebote'),
    ('feelfree-nature-resort', 'audience:familie'),
    ('alpenhotel-montafon', 'theme:natur-pur'),
    ('alpenhotel-montafon', 'theme:wanderurlaub'),
    ('alpenhotel-montafon', 'theme:familienurlaub'),
    ('alpenhotel-montafon', 'theme:wellnessangebote'),
    ('alpenhotel-montafon', 'theme:geschaeftsreisen'),
    ('alpenhotel-montafon', 'theme:radwandern'),
    ('alpenhotel-montafon', 'audience:familie'),
    ('alpenhotel-montafon', 'accommodation:hotel'),
    ('kesselgrub', 'theme:natur-pur'),
    ('kesselgrub', 'theme:wanderurlaub'),
    ('kesselgrub', 'theme:familienurlaub'),
    ('kesselgrub', 'theme:wellnessangebote'),
    ('kesselgrub', 'audience:familie'),
    ('small-und-beautiful-hotel-gnaid', 'theme:natur-pur'),
    ('small-und-beautiful-hotel-gnaid', 'theme:radwandern'),
    ('small-und-beautiful-hotel-gnaid', 'theme:wanderurlaub'),
    ('small-und-beautiful-hotel-gnaid', 'theme:wellnessangebote'),
    ('small-und-beautiful-hotel-gnaid', 'theme:golfurlaub'),
    ('small-und-beautiful-hotel-gnaid', 'accommodation:hotel'),
    ('golf-und-sporthotel-hof-maran', 'theme:natur-pur'),
    ('golf-und-sporthotel-hof-maran', 'theme:nordic-walking'),
    ('golf-und-sporthotel-hof-maran', 'theme:radwandern'),
    ('golf-und-sporthotel-hof-maran', 'theme:wanderurlaub'),
    ('golf-und-sporthotel-hof-maran', 'theme:golfurlaub'),
    ('golf-und-sporthotel-hof-maran', 'theme:familienurlaub'),
    ('golf-und-sporthotel-hof-maran', 'audience:familie'),
    ('golf-und-sporthotel-hof-maran', 'accommodation:hotel'),
    ('wellnesshotel-golfpanorama', 'theme:natur-pur'),
    ('wellnesshotel-golfpanorama', 'theme:wellnessangebote'),
    ('wellnesshotel-golfpanorama', 'theme:golfurlaub'),
    ('wellnesshotel-golfpanorama', 'theme:geschaeftsreisen'),
    ('wellnesshotel-golfpanorama', 'theme:wanderurlaub'),
    ('wellnesshotel-golfpanorama', 'theme:radwandern'),
    ('wellnesshotel-golfpanorama', 'theme:nordic-walking'),
    ('wellnesshotel-golfpanorama', 'accommodation:hotel'),
    ('kaiser-hans-natur-residence', 'theme:natur-pur'),
    ('kaiser-hans-natur-residence', 'theme:radwandern'),
    ('kaiser-hans-natur-residence', 'theme:wanderurlaub'),
    ('pension-steingarten', 'theme:natur-pur'),
    ('pension-steingarten', 'theme:radwandern'),
    ('pension-steingarten', 'theme:wanderurlaub'),
    ('pension-steingarten', 'accommodation:pension')
) AS tagged(slug,term_key) ON tagged.slug=p.slug
JOIN public.travel_terms t ON t.term_key=tagged.term_key
ON CONFLICT (profile_id,term_key) DO NOTHING;
