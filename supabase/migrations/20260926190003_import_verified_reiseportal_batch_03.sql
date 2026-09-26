-- Published Joomla articles and audit decisions: docs/reiseportal-legacy-inventory.json.
-- Batch 3/4, article IDs 478, 477, 476, 474, 473, 472, 471, 469, 467, 466, 463, 460.
-- Only absent slugs are inserted; existing profiles, owners, RLS and media tables stay untouched.
WITH source(joomla_id,slug,name,description,business_areas,street,postal_code,city,country,phone,public_email,website) AS (
  VALUES
    ('478', 'stroblhof', 'Stroblhof', 'Die Kinder sind glücklich, die Eltern entspannt und der langersehnte Urlaub ist ein voller Erfolg – denn in unserem Familienhotel in Südtirol mit Pool haben wir wirklich an alles gedacht.', 'Natur pur, Radwandern, Wanderurlaub, Familienurlaub, Wellnessangebote', 'Passeierstraße 28/29', '39015', 'St. Leonhard in Passeier', 'Italien', '+39 0473 010500', NULL, NULL),
    ('477', 'kronplatz', 'Kronplatz', 'Ein Familienurlaub am Kronplatz bedeutet sowohl im Sommer als auch im Winter vor allem Erholung für die Eltern und jede Menge Spaß für die Kleinsten.', 'Natur pur, Radwandern, Wanderurlaub, Familienurlaub, Wellnessangebote', 'Pfarrstraße 4', '39030', 'Niederolang', 'Italien', '+39 0474 496173', NULL, NULL),
    ('476', 'familienhotel-und-kinderhotel-sonnwies', 'Familienhotel & Kinderhotel Sonnwies', 'Das exklusive Familienhotel Sonnwies - Ihr Hotel für Familien in Südtirol!', 'Natur pur, Radwandern, Wanderurlaub, Familienurlaub, Wellnessangebote', 'Alter Runggerweg 20', '39040', 'Lüsen', 'Italien', '+39 0472 413 533', NULL, NULL),
    ('474', 'alfseeferien-und-erlebnispark', 'ALFSEEFERIEN- UND ERLEBNISPARK', 'Entdecken Sie Ihr Urlaubserlebnis im Osnabrücker Land. Langeweile hat am Alfsee keine Chance!', 'Natur pur, Radwandern, Wanderurlaub, Familienurlaub, Campingurlaub, Wellnessangebote', 'Am Campingpark 10', '49597', 'Rieste', 'Deutschland', '+49-5464-9212-0', NULL, NULL),
    ('473', 'blausee', 'Blausee', '365 TAGE IM JAHR GEÖFFNET! DIE NATUR IN IHREN SCHÖNSTEN FACETTEN

Der Blausee - einer der schönsten Bergseen der Schweiz Wir begrüßen Sie herzlich in unserem kleinen Paradies inmitten der Kandertaler Berge. Die Marke «Blausee» steht für Einzigartigkeit auf ganzer Linie. Gastfreundschaft ist uns sehr wichtig und wir möchten Sie mit all Ihren Sinnen verwöhnen. Der Blausee soll ein Kraftort sein, in dem Sie sich entspannen und die Natur von Ihrer schönsten Seite geniessen können. Es erwartet Sie ein charmant eingerichtetes kleines Grand Hotel mit Spa-Bereich, ein märchenhafter Naturpark und eine 13-Punkte Gault-Millau-Küche, die sie auf eine kulinarische Entdeckungsreise schickt. Auch für Events und Seminare sind wir ausgerüstet und bieten eine traumhafte Location für Ihren Anlass.

Sind Sie einmal am Bielersee unterwegs, besuchen Sie auch unseren Partnerbetrieb auf der St. Petersinsel. Das ehemalige Klosterhotel liegt auf der Südostseite der schönen Halbinsel und serviert liebevoll angerichtete Speisen aus der Region.', 'Geschäftsreisen', 'Blausee 222', '3717', 'Blausee', 'Schweiz', '+41 33 672 33 33', 'info@blausee.ch', 'https://www.blausee.ch/'),
    ('472', 'kemmeriboden-bad', 'Kemmeriboden-Bad', 'Herzlich willkommen im Kemmeriboden Bad!

Erleben Sie unvergessliche Momente im Hotel Landgasthof Kemmeriboden Bad und tauchen Sie ein, in die malerische Schönheit des wild-romantischen Quellgebiets der Emme.

Lassen Sie sich von unserem Restaurantteam kulinarisch verwöhnen und geniessen Sie die Köstlichkeiten aus unserer Region. Unser Hotelteam sorgt für Ihre Erholung im und ums Haus. Verbringen Sie ein paar Tage in einem unserer individuell gestalteten Zimmern und lassen Sie sich von der lieblichen Natur rund um unser Haus verzaubern.', 'Romantik zu zweit', 'Kemmeribodenbad 181', '6197', 'Schangnau', 'Italien', '+41 (0) 34 493 77 77', 'hotel@kemmeriboden.ch', 'https://www.kemmeriboden.ch/'),
    ('471', 'rue-blanch', 'Rü Blanch', 'HOTEL CIASA RÜ BLANCH - Ihr zweites Zuhause!

In unserem Hause, in ruhiger, sonniger Lage oberhalb von St. Kassian – Alta Badia, können Sie so richtig abschalten und Ihre verdiente Ruhe finden. Unser Haus liegt zu Fuße des majestätischen Berges La Varella und genießt über eine atemberaubende Aussicht auf die Dolomiten.

800 m von den Liftanlagen entfernt, ist unser Haus idealer Ausgangspunkt, im Winter zum Skifahren & Langlaufen und im Sommer zum Wandern.', 'Natur pur', 'Str. Glira 39', '39036', 'St. Kassian', 'Italien', '+39 0471 849423', 'info@rublanch.com', 'https://www.rublanch.com/de/'),
    ('469', 'schwarzwaelderhof', 'Schwarzwälderhof', 'Luxusurlaub in Natur und Ruhe.

Hier wartet der Sonnenaufgang auf Sie. Traumhaft eingebettet in die Natur des Schwarzwaldes, auf mehreren Terrassen angelegt und mit allem ausgestattet, was ein herrlicher Campingurlaub braucht. Wo sonst findet man einen 5 Sterne Campingplatz mit Sauna, Wellness, Hallenbad und einem Restaurant direkt mit dabei? Und auch in Punkto Infrastruktur ist hier Camping mit Komfort angesagt. Ein echter Geheimtipp für alle, die beim Camping auch ein wenig Luxus mögen.

Immer wieder betonen unsere Gäste, dass sie es besonders schätzen hier einen wirklich kinderfreundlichen Campingplatz zu haben. Und Hundebesitzer werden bei uns ebenfalls glücklich, denn auf dem Campingplatz sind auch Hunde erlaubt.', 'Campingurlaub, Romantik zu zweit', 'Tretenhofstrasse 76 D', '77960', 'Seelbach', 'Deutschland', '+49 (0) 78 23 / 96 09 50', 'info@spacamping.de', 'https://spacamping.de/de/'),
    ('467', 'camping-resort-allweglehen', 'Camping Resort Allweglehen', 'Der erste Reisemobilstellplatz in Berchtesgaden!

In der Vergangenheit suchten Feriengäste, die mit dem Wohnmobil unterwegs waren, in Berchtesgaden vergeblich nach einem geeigneten Stellplatz. Diesem Mangel können wir nun abhelfen! Wir bieten Ihnen nunmehr auf unserem Grundstück, nur 100 Meter unterhalb des Campingareals, 28 großzügig angelegte Stellplätze in einem leicht zugänglichen Bereich und in ruhiger Lage.

Dank unseres 24-Stunden-Check-In-Services genießen Sie eine weitgehende Ungebundenheit. Eine Wasserzapfstelle, eine Entsorgungsstation und ein kostenfreier Stromanschluss sind vorhanden. Außerdem können Sie die Sanitären Einrichtungen des Campingplatzes nutzen, sofern Sie es wünschen.', 'Urlaub am Wasser, Campingurlaub, Natur pur', 'Allweggasse 4', '83471', 'Berchtesgaden', 'Deutschland', '+49 8652 2396', 'urlaub@allweglehen.de', 'https://www.allweglehen.de/de/'),
    ('466', 'the-chedi', 'The Chedi', 'IHR SCHWEIZER GOLFURLAUB IM HOTEL THE CHEDI ANDERMATT

Sie suchen ein Golfhotel in der Schweiz, dass nicht nur mit Golfplatz-Nähe, sondern auch mit höchster Qualität und einer überragenden Gastlichkeit überzeugt? Im The Chedi Andermatt sind Sie an der richtigen Adresse: Nur wenige Minuten vom Hotel wartet der Par-72-Championship-Golfplatz der Swiss PGA mit 18 Loch. Wer beim Bälleschlagen Abwechslung sucht, findet diese auf drei weiteren Golfplätzen in nächster Umgebung. So verfügen Sedrun, Realp und Source du Rhône über je einen 9-Loch-Golfplatz und bilden gemeinsam mit dem Andermatter Green echtes "Alpine Golf". The Chedi Andermatt – der perfekte Ort für einen Golfurlaub in der Schweiz, der keine Wünsche unerfüllt lässt.

CRAFTING MEMORIES Das «The Chedi Andermatt» zählt zu den renommiertesten Luxushotels der Schweiz und ist ein Ort zum Wohlfühlen, umgeben von einer atemberaubenden Natur. In diesem luxuriösen Fünfsternehotel trifft dezente Eleganz auf modernen Lifestyle, verschmelzen asiatische Elemente mit alpinem Chic.', 'Golfurlaub, Geschäftsreisen', 'Gotthardstrasse 4', '6490', 'Andermatt', 'Schweiz', '+41 41 888 74 88', 'info@chediandermatt.com', 'https://www.thechediandermatt.com/de'),
    ('463', 'jaegeralpe', 'Jägeralpe', 'URLAUB IN IHREM FAMILIENGEFÜHRTEN 4*SUPERIOR HOTEL IN WARTH AM ARLBERG! Das Haus für sportliche Genießer.

EINEN AUSZUG UNSERER GEFÜHRTEN WANDERUNGEN DÜRFEN WIR IHNEN HIER VORSTELLEN.

In Kleingruppen den Arlberg erkunden Familie Jäger, selbst alles begeisterte Wanderer und Bergsteiger, begleiten Sie bei Ihren Touren am Arlberg. Oskar, Oswald, Jasmin, Brigitte und Marcel sind alles ausgebildete Wanderführer und stehen Ihnen für jegliche Fragen zur Seite und geben Ihnen Tipps zu den schönsten Touren und Geheimtipps. Oskar Jäger begleitet Sie bei den meisten Touren, aber auch die anderen Familienmitglieder freuen sich, mit Ihnen auf Tour zu gehen!', 'Wanderurlaub', 'Hochkrumbach 5', '6767', 'Warth am Arlberg', 'Österreich', '+43 5583 4250', 'hotel@jaegeralpe.at', 'https://www.jaegeralpe.at/.iisnode'),
    ('460', 'feldhof-dolcevita-resort', 'FELDHOF DOLCEVITA RESORT', 'Romantik unter Sternen. Zeit mit den Menschen, die uns wichtig sind. Wellnessglück. Aktivitäten und süßes Nichtstun perfekt kombiniert: Willkommen im Wellnesshotel Naturns, Südtirol.

Urlaub im Wellnesshotel bei Meran ist Quality-Time für jeden. ZEIT FÜR UNS

So charmant und federleicht wie das Südtiroler Lebensgefühl ist Urlaub in unserem 4-Sterne-Superior-Wellnesshotel in Naturns bei Meran. Dolce Vita eben. Zwischen Naturlandschaft und faszinierender Gipfelwelt mit 315 Sonnentagen im Jahr. Hier treffen mediterrane Lebensfreude und alpine Gemütlichkeit aufeinander und vereinen sich zu einem unvergleichlichen Urlaubsfeeling.', 'Radwandern, Familienurlaub, Wellnessangebote', 'Rathausstraße 4', '39025', 'Naturns', 'Italien', '+39 0473 666 366', 'iinfo@feldhof.com', 'https://www.feldhof.com/')
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
    ('stroblhof', 'theme:natur-pur'),
    ('stroblhof', 'theme:radwandern'),
    ('stroblhof', 'theme:wanderurlaub'),
    ('stroblhof', 'theme:familienurlaub'),
    ('stroblhof', 'theme:wellnessangebote'),
    ('stroblhof', 'audience:familie'),
    ('kronplatz', 'theme:natur-pur'),
    ('kronplatz', 'theme:radwandern'),
    ('kronplatz', 'theme:wanderurlaub'),
    ('kronplatz', 'theme:familienurlaub'),
    ('kronplatz', 'theme:wellnessangebote'),
    ('kronplatz', 'audience:familie'),
    ('familienhotel-und-kinderhotel-sonnwies', 'theme:natur-pur'),
    ('familienhotel-und-kinderhotel-sonnwies', 'theme:radwandern'),
    ('familienhotel-und-kinderhotel-sonnwies', 'theme:wanderurlaub'),
    ('familienhotel-und-kinderhotel-sonnwies', 'theme:familienurlaub'),
    ('familienhotel-und-kinderhotel-sonnwies', 'theme:wellnessangebote'),
    ('familienhotel-und-kinderhotel-sonnwies', 'audience:familie'),
    ('familienhotel-und-kinderhotel-sonnwies', 'accommodation:hotel'),
    ('alfseeferien-und-erlebnispark', 'theme:natur-pur'),
    ('alfseeferien-und-erlebnispark', 'theme:radwandern'),
    ('alfseeferien-und-erlebnispark', 'theme:wanderurlaub'),
    ('alfseeferien-und-erlebnispark', 'theme:familienurlaub'),
    ('alfseeferien-und-erlebnispark', 'theme:campingurlaub'),
    ('alfseeferien-und-erlebnispark', 'theme:wellnessangebote'),
    ('alfseeferien-und-erlebnispark', 'audience:familie'),
    ('blausee', 'theme:geschaeftsreisen'),
    ('kemmeriboden-bad', 'theme:romantik-zu-zweit'),
    ('kemmeriboden-bad', 'audience:paar'),
    ('rue-blanch', 'theme:natur-pur'),
    ('schwarzwaelderhof', 'theme:campingurlaub'),
    ('schwarzwaelderhof', 'theme:romantik-zu-zweit'),
    ('schwarzwaelderhof', 'audience:paar'),
    ('camping-resort-allweglehen', 'theme:urlaub-am-wasser'),
    ('camping-resort-allweglehen', 'theme:campingurlaub'),
    ('camping-resort-allweglehen', 'theme:natur-pur'),
    ('camping-resort-allweglehen', 'accommodation:camping'),
    ('the-chedi', 'theme:golfurlaub'),
    ('the-chedi', 'theme:geschaeftsreisen'),
    ('jaegeralpe', 'theme:wanderurlaub'),
    ('feldhof-dolcevita-resort', 'theme:radwandern'),
    ('feldhof-dolcevita-resort', 'theme:familienurlaub'),
    ('feldhof-dolcevita-resort', 'theme:wellnessangebote'),
    ('feldhof-dolcevita-resort', 'audience:familie')
) AS tagged(slug,term_key) ON tagged.slug=p.slug
JOIN public.travel_terms t ON t.term_key=tagged.term_key
ON CONFLICT (profile_id,term_key) DO NOTHING;
