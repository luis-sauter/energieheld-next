BEGIN;
-- Creative metadata is independent of booking targets and display slots.
CREATE TABLE public.ad_banner_search_metadata (
 banner_key text PRIMARY KEY,
 campaign_id uuid UNIQUE REFERENCES public.company_ad_campaigns(id) ON DELETE CASCADE,
 legacy_name text,
 postal_code text NOT NULL DEFAULT '' CHECK (char_length(postal_code)<=20),
 city text NOT NULL DEFAULT '' CHECK (char_length(city)<=120),
 CHECK ((campaign_id IS NOT NULL AND banner_key='campaign:' || campaign_id::text AND legacy_name IS NULL)
 OR (campaign_id IS NULL AND banner_key LIKE 'legacy:http%' AND char_length(legacy_name) BETWEEN 1 AND 100))
);
CREATE TABLE public.ad_banner_search_terms (
 banner_key text REFERENCES public.ad_banner_search_metadata(banner_key) ON DELETE CASCADE,
 term_key text REFERENCES public.travel_terms(term_key), PRIMARY KEY(banner_key,term_key)
);
-- Proven exported source mappings, used only to determine public search eligibility.
-- Existing code remains the delivery source. No guessed location/category values.
CREATE TABLE public.ad_legacy_banner_search_sources (
 path text NOT NULL, placement text NOT NULL, banner_key text NOT NULL REFERENCES public.ad_banner_search_metadata(banner_key),
 target_url text NOT NULL, PRIMARY KEY(path,placement)
);

INSERT INTO public.ad_banner_search_metadata(banner_key,legacy_name) VALUES
('legacy:https://neue-schaenke.de/','Neue Schaenke'),
('legacy:https://city-apart-dresden.de/','City Apart Dresden'),
('legacy:https://haus-salzburg.de/','Haus Salzburg Bad Füssing'),
('legacy:https://ferienanlage-am-nationalpark.de/','Ferienanlage am Nationalpark'),
('legacy:https://annis-romantikhaeuschen.de/','Annis Romantikhaeuschen'),
('legacy:https://fewo-sieber.de/','Ferienwohnung Sieber'),
('legacy:https://rodelbahn-oderwitz.de/','Rodelbahn Oderwitz'),
('legacy:https://ferienbauernhof-buechele.de/','Ferienbauernhof Büchele'),
('legacy:https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/','Barfusspark'),
('legacy:https://hotel-kronplatz.com/de/','Hotel Kronplatz'),
('legacy:https://kesselgrub.at/de','Kesselgrub'),
('legacy:https://ostseehotel-dierhagen.de/de/home','Ostseehotel Dierhagen'),
('legacy:https://aparthotel-oberhof.de/','Aparthotel Oberhof'),
('legacy:https://landhotel-schafhuber.at/wandern/','Schafhuber'),
('legacy:https://westerwald.info/','Westerwald'),
('legacy:https://feldhof.com/','Feldhof'),
('legacy:https://muehlvitalresort.de/','Mühl Vital Resort'),
('legacy:https://landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking','Landhotel Talblick'),
('legacy:https://aktivitalhotel.de/region/aktivurlaub/nordic-walking','Aktivital Hotel'),
('legacy:https://hoeflehner.com/Aktiv/Wandern','Höflehner'),
('legacy:https://neckartalradweg-bw.de/','Neckartal'),
('legacy:https://visitmosel.de/familienurlaub/radfahren','Mosellandtouristik GmbH'),
('legacy:https://zumgoldenenochsen.de/kultur-freizeit-and-erholung/','Hotel zum goldenen Ochsen'),
('legacy:https://fischer-hopfensee.de/erleben/','Hotel Fischer am See'),
('legacy:https://hotel-ruchti.de/urlaub-in-fuessen/fuessen','Hotel Ruchti'),
('legacy:https://chiemsee-alpenland.de/','Chiemsee Alpenland'),
('legacy:https://hotel-helmer.de/','Hotel Helmer'),
('legacy:https://vulkanradweg.de/die-gastgeber/radtouren-fuer-sie-organisiert.html','Vulkan Radweg'),
('legacy:https://feldhof.com/aktivurlaub/wandern/','Feldhof'),
('legacy:https://jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode','Jägeralpe'),
('legacy:https://sonnwies.com/familienhotel-suedtirol','Sonnwies'),
('legacy:https://rhoen-park-hotel.de/familienhotel/','Röhn Park Hotel'),
('legacy:https://hoeflehner.com/Preise-Angebote/Familienurlaub-in-Oesterreich','Höflehner'),
('legacy:https://godewind-thiessow.de/','Godewind'),
('legacy:https://luxoase.de/','Luxoase'),
('legacy:https://camping-teichmann.de/','Camping Teichmann'),
('legacy:https://hommage-hotels.com/grand-tirolia-kitzbuehel/golf-eichenheim','Grand Tirolia'),
('legacy:https://johanneshof.com/de/','Johanneshof'),
('legacy:https://thechediandermatt.com/de/explore/golfhotel-schweiz','The Chedi'),
('legacy:https://golfpanorama.ch/','Gold Panorama'),
('legacy:https://hofmaran.ch/','Hof Maran'),
('legacy:https://gnaid.it/','Gnaid'),
('legacy:https://stroblhof.com/','Stroblhof'),
('legacy:https://rcf-tauchreisen.de/','Reisecenter Federsee'),
('legacy:https://sub-aqua.de/','SUB Aqua'),
('legacy:https://schoener-tauchen.de/','Schoener Tauchen'),
('legacy:https://wernerlau.com/tauchen-malediven/','Werner Lau'),
('legacy:https://tauchsport-egginger.de/','Tauchschule Egginger'),
('legacy:https://beyond-diving.de/','Beyond Diving'),
('legacy:https://sunandfun.com/tauchen/Tauchsafaris/','Sun Fun'),
('legacy:https://belugareisen.de/','Beluga Reisen'),
('legacy:https://wirodive.de/','Wiro Dive'),
('legacy:https://hotelhirschen-bodensee.de/Hotel','Hotel Hirschen Horn'),
('legacy:https://alfsee.de/','Alfsee'),
('legacy:https://roewers.de/','Röwers'),
('legacy:https://schlosshotel-ralswiek.de/','Schlosshotel Ralswiek'),
('legacy:https://camping-amrum.de/','Dünencamping Amrum'),
('legacy:https://bayregio.de/gastgeber/Campingplatz-Halbinsel-Burg','Halbinsel Burg'),
('legacy:https://allweglehen.de/de/','Allweglehen'),
('legacy:https://spacamping.de/de/angebote/angebote/angebot-zweisamkeit.php','Schwarzwälderhof'),
('legacy:https://alpenhotel-montafon.net/veranstaltungen-vorarlberg/hochzeitslocation/','Alpenhotel Hochzeit'),
('legacy:https://nature-resort.at/willkommen.html','Nature Resort'),
('legacy:https://mondschein.com/','Mondschein'),
('legacy:https://rhoen-park-hotel.de/schwimmbad-sauna-fitness-wellness/','Röhn Park Hotel'),
('legacy:https://hoeflehner.com/Wellness/Naturelle-Behandlungen2','Höflehner'),
('legacy:https://alpenhotel-montafon.net/','Alpenhotel'),
('legacy:https://josef.bz/de/hotel-hafling/1-0.html','Hof Maran'),
('legacy:https://hyatt.com/en-US/hotel/germany/lindner-hotel-cologne-city-plaza/cgnjd/special-events','Lindner Hotels'),
('legacy:https://dasbayrischzell.de/de/seminare/move-work','Das Bayrischzell'),
('legacy:https://hotel-clemens-august.de/tagungshotel-im-muensterland','Clemens August'),
('legacy:https://landgut-ramshof.de/tagungen/','Landgut Ramshof'),
('legacy:https://mintrops-landhotel.de/','Mintrops Lanhotel'),
('legacy:https://rhoen-park-hotel.de/tagungshotel/','Röhn Park Hotel'),
('legacy:https://landhotel-talblick.de/','Landhotel Talblick'),
('legacy:https://hoeflehner.com/','Höflehner'),
('legacy:https://haus-terra.at/','Haus Terra'),
('legacy:https://laerchenhof.com/','Lärchenhof'),
('legacy:https://villnerhof.com/','Villner Hof'),
('legacy:https://steingarten.it/','Pension Steingarten'),
('legacy:https://kaiser-hans.com/','Kaiser Hans'),
('legacy:https://almhof-call.com/','Almhof Call');
INSERT INTO public.ad_legacy_banner_search_sources(path,placement,banner_key,target_url) VALUES
('/','top_banner','legacy:https://neue-schaenke.de/','https://www.neue-schaenke.de/'),
('/','sidebar_top','legacy:https://city-apart-dresden.de/','https://city-apart-dresden.de/'),
('/','sidebar_middle','legacy:https://haus-salzburg.de/','https://haus-salzburg.de/'),
('/','sidebar_bottom','legacy:https://ferienanlage-am-nationalpark.de/','https://www.ferienanlage-am-nationalpark.de/'),
('/','sidebar_04','legacy:https://annis-romantikhaeuschen.de/','https://www.annis-romantikhaeuschen.de/'),
('/','sidebar_05','legacy:https://fewo-sieber.de/','https://fewo-sieber.de/index.html'),
('/','sidebar_06','legacy:https://city-apart-dresden.de/','https://city-apart-dresden.de/index.php'),
('/','sidebar_07','legacy:https://rodelbahn-oderwitz.de/','https://rodelbahn-oderwitz.de/'),
('/','sidebar_08','legacy:https://ferienbauernhof-buechele.de/','https://www.ferienbauernhof-buechele.de/'),
('/','sidebar_09','legacy:https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/','https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/'),
('/','sidebar_10','legacy:https://neue-schaenke.de/','https://www.neue-schaenke.de/'),
('/unterkuenfte-a-z','sidebar_top','legacy:https://city-apart-dresden.de/','https://city-apart-dresden.de/'),
('/unterkuenfte-a-z','sidebar_middle','legacy:https://haus-salzburg.de/','https://haus-salzburg.de/'),
('/unterkuenfte-a-z','sidebar_bottom','legacy:https://ferienanlage-am-nationalpark.de/','https://www.ferienanlage-am-nationalpark.de/'),
('/unterkuenfte-a-z','sidebar_04','legacy:https://annis-romantikhaeuschen.de/','https://www.annis-romantikhaeuschen.de/'),
('/unterkuenfte-a-z','sidebar_05','legacy:https://fewo-sieber.de/','https://fewo-sieber.de/index.html'),
('/unterkuenfte-a-z','sidebar_06','legacy:https://city-apart-dresden.de/','https://city-apart-dresden.de/index.php'),
('/unterkuenfte-a-z','sidebar_07','legacy:https://rodelbahn-oderwitz.de/','https://rodelbahn-oderwitz.de/'),
('/unterkuenfte-a-z','sidebar_08','legacy:https://ferienbauernhof-buechele.de/','https://www.ferienbauernhof-buechele.de/'),
('/unterkuenfte-a-z','sidebar_09','legacy:https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/','https://www.barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/'),
('/unterkuenfte-a-z','sidebar_10','legacy:https://neue-schaenke.de/','https://www.neue-schaenke.de/'),
('/mottoreisen/natur-pur','top_banner','legacy:https://neue-schaenke.de/','https://www.neue-schaenke.de/'),
('/mottoreisen/natur-pur','sidebar_top','legacy:https://annis-romantikhaeuschen.de/','https://www.annis-romantikhaeuschen.de/'),
('/mottoreisen/natur-pur','sidebar_middle','legacy:https://annis-romantikhaeuschen.de/','https://www.annis-romantikhaeuschen.de/'),
('/mottoreisen/natur-pur','sidebar_bottom','legacy:https://hotel-kronplatz.com/de/','https://www.hotel-kronplatz.com/de/'),
('/mottoreisen/natur-pur','sidebar_04','legacy:https://kesselgrub.at/de','https://www.kesselgrub.at/de'),
('/mottoreisen/natur-pur','sidebar_05','legacy:https://ostseehotel-dierhagen.de/de/home','https://www.ostseehotel-dierhagen.de/de/home'),
('/mottoreisen/natur-pur','sidebar_06','legacy:https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/','https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/'),
('/mottoreisen/natur-pur','sidebar_07','legacy:https://aparthotel-oberhof.de/','https://www.aparthotel-oberhof.de/'),
('/mottoreisen/natur-pur','sidebar_08','legacy:https://ostseehotel-dierhagen.de/de/home','https://www.ostseehotel-dierhagen.de/de/home'),
('/mottoreisen/natur-pur','sidebar_09','legacy:https://neue-schaenke.de/','https://www.neue-schaenke.de/'),
('/mottoreisen/nordic-walking','top_banner','legacy:https://landhotel-schafhuber.at/wandern/','https://www.landhotel-schafhuber.at/wandern/'),
('/mottoreisen/nordic-walking','sidebar_top','legacy:https://ostseehotel-dierhagen.de/de/home','https://www.ostseehotel-dierhagen.de/de/home'),
('/mottoreisen/nordic-walking','sidebar_middle','legacy:https://westerwald.info/','https://www.westerwald.info/'),
('/mottoreisen/nordic-walking','sidebar_bottom','legacy:https://feldhof.com/','https://www.feldhof.com/'),
('/mottoreisen/nordic-walking','sidebar_04','legacy:https://muehlvitalresort.de/','https://www.muehlvitalresort.de/'),
('/mottoreisen/nordic-walking','sidebar_05','legacy:https://landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking','https://www.landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking'),
('/mottoreisen/nordic-walking','sidebar_06','legacy:https://aktivitalhotel.de/region/aktivurlaub/nordic-walking','https://www.aktivitalhotel.de/region/aktivurlaub/nordic-walking'),
('/mottoreisen/nordic-walking','sidebar_07','legacy:https://hoeflehner.com/Aktiv/Wandern','https://www.hoeflehner.com/Aktiv/Wandern'),
('/mottoreisen/radwandern','top_banner','legacy:https://neckartalradweg-bw.de/','https://www.neckartalradweg-bw.de/'),
('/mottoreisen/radwandern','sidebar_top','legacy:https://visitmosel.de/familienurlaub/radfahren','https://www.visitmosel.de/familienurlaub/radfahren'),
('/mottoreisen/radwandern','sidebar_middle','legacy:https://zumgoldenenochsen.de/kultur-freizeit-and-erholung/','https://zumgoldenenochsen.de/kultur-freizeit-and-erholung/'),
('/mottoreisen/radwandern','sidebar_bottom','legacy:https://fischer-hopfensee.de/erleben/','https://fischer-hopfensee.de/erleben/'),
('/mottoreisen/radwandern','sidebar_04','legacy:https://hotel-ruchti.de/urlaub-in-fuessen/fuessen','https://www.hotel-ruchti.de/urlaub-in-fuessen/fuessen'),
('/mottoreisen/radwandern','sidebar_05','legacy:https://chiemsee-alpenland.de/','https://www.chiemsee-alpenland.de/'),
('/mottoreisen/radwandern','sidebar_06','legacy:https://hotel-helmer.de/','https://www.hotel-helmer.de/'),
('/mottoreisen/radwandern','sidebar_07','legacy:https://vulkanradweg.de/die-gastgeber/radtouren-fuer-sie-organisiert.html','https://www.vulkanradweg.de/die-gastgeber/radtouren-fuer-sie-organisiert.html'),
('/mottoreisen/radwandern','sidebar_08','legacy:https://neue-schaenke.de/','https://www.neue-schaenke.de/'),
('/mottoreisen/wanderurlaub','top_banner','legacy:https://landhotel-schafhuber.at/wandern/','https://www.landhotel-schafhuber.at/wandern/'),
('/mottoreisen/wanderurlaub','sidebar_top','legacy:https://annis-romantikhaeuschen.de/','https://www.annis-romantikhaeuschen.de/'),
('/mottoreisen/wanderurlaub','sidebar_middle','legacy:https://westerwald.info/','https://www.westerwald.info/'),
('/mottoreisen/wanderurlaub','sidebar_bottom','legacy:https://feldhof.com/aktivurlaub/wandern/','https://www.feldhof.com/aktivurlaub/wandern/'),
('/mottoreisen/wanderurlaub','sidebar_04','legacy:https://landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking','https://www.landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking'),
('/mottoreisen/wanderurlaub','sidebar_05','legacy:https://jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode','https://www.jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode'),
('/mottoreisen/wanderurlaub','sidebar_06','legacy:https://hoeflehner.com/Aktiv/Wandern','https://www.hoeflehner.com/Aktiv/Wandern'),
('/mottoreisen/familienurlaub','top_banner','legacy:https://sonnwies.com/familienhotel-suedtirol','https://www.sonnwies.com/familienhotel-suedtirol'),
('/mottoreisen/familienurlaub','sidebar_top','legacy:https://visitmosel.de/familienurlaub/radfahren','https://www.visitmosel.de/familienurlaub/radfahren'),
('/mottoreisen/familienurlaub','sidebar_middle','legacy:https://kesselgrub.at/de','https://www.kesselgrub.at/de'),
('/mottoreisen/familienurlaub','sidebar_bottom','legacy:https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/','https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/'),
('/mottoreisen/familienurlaub','sidebar_04','legacy:https://rhoen-park-hotel.de/familienhotel/','https://www.rhoen-park-hotel.de/familienhotel/'),
('/mottoreisen/familienurlaub','sidebar_05','legacy:https://ferienbauernhof-buechele.de/','https://www.ferienbauernhof-buechele.de/'),
('/mottoreisen/familienurlaub','sidebar_06','legacy:https://hoeflehner.com/Preise-Angebote/Familienurlaub-in-Oesterreich','https://www.hoeflehner.com/Preise-Angebote/Familienurlaub-in-Oesterreich'),
('/mottoreisen/familienurlaub','sidebar_07','legacy:https://godewind-thiessow.de/','https://godewind-thiessow.de/'),
('/mottoreisen/familienurlaub','sidebar_08','legacy:https://luxoase.de/','https://www.luxoase.de/'),
('/mottoreisen/familienurlaub','sidebar_09','legacy:https://camping-teichmann.de/','https://www.camping-teichmann.de/'),
('/mottoreisen/familienurlaub','sidebar_10','legacy:https://hotel-kronplatz.com/de/','https://www.hotel-kronplatz.com/de/'),
('/mottoreisen/golfurlaub','top_banner','legacy:https://hommage-hotels.com/grand-tirolia-kitzbuehel/golf-eichenheim','https://www.hommage-hotels.com/grand-tirolia-kitzbuehel/golf-eichenheim'),
('/mottoreisen/golfurlaub','sidebar_top','legacy:https://johanneshof.com/de/','https://www.johanneshof.com/de/'),
('/mottoreisen/golfurlaub','sidebar_middle','legacy:https://thechediandermatt.com/de/explore/golfhotel-schweiz','https://www.thechediandermatt.com/de/explore/golfhotel-schweiz'),
('/mottoreisen/golfurlaub','sidebar_bottom','legacy:https://golfpanorama.ch/','https://www.golfpanorama.ch/'),
('/mottoreisen/golfurlaub','sidebar_04','legacy:https://hofmaran.ch/','https://hofmaran.ch/'),
('/mottoreisen/golfurlaub','sidebar_05','legacy:https://gnaid.it/','https://www.gnaid.it/'),
('/mottoreisen/golfurlaub','sidebar_06','legacy:https://stroblhof.com/','https://www.stroblhof.com/'),
('/mottoreisen/tauchurlaub','top_banner','legacy:https://rcf-tauchreisen.de/','https://rcf-tauchreisen.de/'),
('/mottoreisen/tauchurlaub','sidebar_top','legacy:https://sub-aqua.de/','https://www.sub-aqua.de/'),
('/mottoreisen/tauchurlaub','sidebar_middle','legacy:https://schoener-tauchen.de/','https://www.schoener-tauchen.de/'),
('/mottoreisen/tauchurlaub','sidebar_bottom','legacy:https://wernerlau.com/tauchen-malediven/','https://www.wernerlau.com/tauchen-malediven/'),
('/mottoreisen/tauchurlaub','sidebar_04','legacy:https://tauchsport-egginger.de/','https://www.tauchsport-egginger.de/index.php'),
('/mottoreisen/tauchurlaub','sidebar_05','legacy:https://beyond-diving.de/','https://beyond-diving.de/'),
('/mottoreisen/tauchurlaub','sidebar_06','legacy:https://sunandfun.com/tauchen/Tauchsafaris/','https://www.sunandfun.com/tauchen/Tauchsafaris/'),
('/mottoreisen/tauchurlaub','sidebar_07','legacy:https://belugareisen.de/','https://www.belugareisen.de/'),
('/mottoreisen/tauchurlaub','sidebar_08','legacy:https://wirodive.de/','https://wirodive.de/'),
('/mottoreisen/urlaub-am-wasser','top_banner','legacy:https://hotelhirschen-bodensee.de/Hotel','https://www.hotelhirschen-bodensee.de/Hotel'),
('/mottoreisen/urlaub-am-wasser','sidebar_top','legacy:https://alfsee.de/','https://www.alfsee.de/'),
('/mottoreisen/urlaub-am-wasser','sidebar_middle','legacy:https://ostseehotel-dierhagen.de/de/home','https://www.ostseehotel-dierhagen.de/de/home'),
('/mottoreisen/urlaub-am-wasser','sidebar_bottom','legacy:https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/','https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/'),
('/mottoreisen/urlaub-am-wasser','sidebar_04','legacy:https://roewers.de/','https://roewers.de/'),
('/mottoreisen/urlaub-am-wasser','sidebar_05','legacy:https://godewind-thiessow.de/','https://godewind-thiessow.de/'),
('/mottoreisen/urlaub-am-wasser','sidebar_06','legacy:https://schlosshotel-ralswiek.de/','https://www.schlosshotel-ralswiek.de/'),
('/mottoreisen/campingurlaub','top_banner','legacy:https://camping-amrum.de/','https://www.camping-amrum.de/'),
('/mottoreisen/campingurlaub','sidebar_top','legacy:https://alfsee.de/','https://www.alfsee.de/'),
('/mottoreisen/campingurlaub','sidebar_middle','legacy:https://bayregio.de/gastgeber/Campingplatz-Halbinsel-Burg','https://www.bayregio.de/gastgeber/Campingplatz-Halbinsel-Burg'),
('/mottoreisen/campingurlaub','sidebar_bottom','legacy:https://allweglehen.de/de/','https://www.allweglehen.de/de/'),
('/mottoreisen/campingurlaub','sidebar_04','legacy:https://luxoase.de/','https://www.luxoase.de/'),
('/mottoreisen/campingurlaub','sidebar_05','legacy:https://camping-teichmann.de/','https://www.camping-teichmann.de/'),
('/mottoreisen/romantik-zu-zweit','sidebar_top','legacy:https://annis-romantikhaeuschen.de/','https://www.annis-romantikhaeuschen.de/'),
('/mottoreisen/romantik-zu-zweit','sidebar_middle','legacy:https://spacamping.de/de/angebote/angebote/angebot-zweisamkeit.php','https://spacamping.de/de/angebote/angebote/angebot-zweisamkeit.php'),
('/mottoreisen/romantik-zu-zweit','sidebar_bottom','legacy:https://alpenhotel-montafon.net/veranstaltungen-vorarlberg/hochzeitslocation/','https://www.alpenhotel-montafon.net/veranstaltungen-vorarlberg/hochzeitslocation/'),
('/mottoreisen/romantik-zu-zweit','sidebar_04','legacy:https://nature-resort.at/willkommen.html','https://www.nature-resort.at/willkommen.html'),
('/mottoreisen/romantik-zu-zweit','sidebar_05','legacy:https://mondschein.com/','https://www.mondschein.com/'),
('/mottoreisen/wellnessangebote','top_banner','legacy:https://hotelhirschen-bodensee.de/Hotel','https://www.hotelhirschen-bodensee.de/Hotel'),
('/mottoreisen/wellnessangebote','sidebar_top','legacy:https://rhoen-park-hotel.de/schwimmbad-sauna-fitness-wellness/','https://www.rhoen-park-hotel.de/schwimmbad-sauna-fitness-wellness/'),
('/mottoreisen/wellnessangebote','sidebar_middle','legacy:https://hoeflehner.com/Wellness/Naturelle-Behandlungen2','https://www.hoeflehner.com/Wellness/Naturelle-Behandlungen2'),
('/mottoreisen/wellnessangebote','sidebar_bottom','legacy:https://roewers.de/','https://roewers.de/'),
('/mottoreisen/wellnessangebote','sidebar_04','legacy:https://alpenhotel-montafon.net/','https://www.alpenhotel-montafon.net/'),
('/mottoreisen/wellnessangebote','sidebar_05','legacy:https://hofmaran.ch/','https://hofmaran.ch/'),
('/mottoreisen/wellnessangebote','sidebar_06','legacy:https://josef.bz/de/hotel-hafling/1-0.html','https://www.josef.bz/de/hotel-hafling/1-0.html'),
('/mottoreisen/geschaeftsreisen','top_banner','legacy:https://hyatt.com/en-US/hotel/germany/lindner-hotel-cologne-city-plaza/cgnjd/special-events','https://www.hyatt.com/en-US/hotel/germany/lindner-hotel-cologne-city-plaza/cgnjd/special-events'),
('/mottoreisen/geschaeftsreisen','sidebar_top','legacy:https://dasbayrischzell.de/de/seminare/move-work','https://www.dasbayrischzell.de/de/seminare/move-work'),
('/mottoreisen/geschaeftsreisen','sidebar_middle','legacy:https://hotel-clemens-august.de/tagungshotel-im-muensterland','https://www.hotel-clemens-august.de/tagungshotel-im-muensterland'),
('/mottoreisen/geschaeftsreisen','sidebar_bottom','legacy:https://landgut-ramshof.de/tagungen/','https://landgut-ramshof.de/tagungen/'),
('/mottoreisen/geschaeftsreisen','sidebar_04','legacy:https://mintrops-landhotel.de/','https://www.mintrops-landhotel.de/'),
('/mottoreisen/geschaeftsreisen','sidebar_05','legacy:https://rhoen-park-hotel.de/tagungshotel/','https://www.rhoen-park-hotel.de/tagungshotel/'),
('/mottoreisen/geschaeftsreisen','sidebar_06','legacy:https://schlosshotel-ralswiek.de/','https://www.schlosshotel-ralswiek.de/'),
('/reiseziele/deutschland','top_banner','legacy:https://hotelhirschen-bodensee.de/Hotel','https://www.hotelhirschen-bodensee.de/Hotel'),
('/reiseziele/deutschland','sidebar_top','legacy:https://city-apart-dresden.de/','https://city-apart-dresden.de/'),
('/reiseziele/deutschland','sidebar_middle','legacy:https://annis-romantikhaeuschen.de/','https://www.annis-romantikhaeuschen.de/'),
('/reiseziele/deutschland','sidebar_bottom','legacy:https://landhotel-talblick.de/','https://www.landhotel-talblick.de/'),
('/reiseziele/deutschland','sidebar_04','legacy:https://roewers.de/','https://roewers.de/'),
('/reiseziele/deutschland','sidebar_05','legacy:https://godewind-thiessow.de/','https://godewind-thiessow.de/'),
('/reiseziele/deutschland','sidebar_06','legacy:https://schlosshotel-ralswiek.de/','https://www.schlosshotel-ralswiek.de/'),
('/reiseziele/deutschland','sidebar_07','legacy:https://neue-schaenke.de/','https://www.neue-schaenke.de/'),
('/reiseziele/oesterreich','top_banner','legacy:https://landhotel-schafhuber.at/wandern/','https://www.landhotel-schafhuber.at/wandern/'),
('/reiseziele/oesterreich','sidebar_top','legacy:https://kesselgrub.at/de','https://www.kesselgrub.at/de'),
('/reiseziele/oesterreich','sidebar_middle','legacy:https://jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode','https://www.jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode'),
('/reiseziele/oesterreich','sidebar_bottom','legacy:https://hoeflehner.com/','https://www.hoeflehner.com'),
('/reiseziele/oesterreich','sidebar_04','legacy:https://alpenhotel-montafon.net/','https://www.alpenhotel-montafon.net/'),
('/reiseziele/oesterreich','sidebar_05','legacy:https://nature-resort.at/willkommen.html','https://www.nature-resort.at/willkommen.html'),
('/reiseziele/oesterreich','sidebar_06','legacy:https://mondschein.com/','https://www.mondschein.com/'),
('/reiseziele/oesterreich','sidebar_07','legacy:https://haus-terra.at/','https://www.haus-terra.at/'),
('/reiseziele/oesterreich','sidebar_08','legacy:https://laerchenhof.com/','https://www.laerchenhof.com/'),
('/reiseziele/schweiz','sidebar_top','legacy:https://thechediandermatt.com/de/explore/golfhotel-schweiz','https://www.thechediandermatt.com/de/explore/golfhotel-schweiz'),
('/reiseziele/schweiz','sidebar_middle','legacy:https://golfpanorama.ch/','https://www.golfpanorama.ch/'),
('/reiseziele/schweiz','sidebar_bottom','legacy:https://hofmaran.ch/','https://hofmaran.ch/'),
('/reiseziele/suedtirol-italien','top_banner','legacy:https://sonnwies.com/familienhotel-suedtirol','https://www.sonnwies.com/familienhotel-suedtirol'),
('/reiseziele/suedtirol-italien','sidebar_top','legacy:https://hotel-kronplatz.com/de/','https://www.hotel-kronplatz.com/de/'),
('/reiseziele/suedtirol-italien','sidebar_middle','legacy:https://gnaid.it/','https://www.gnaid.it/'),
('/reiseziele/suedtirol-italien','sidebar_bottom','legacy:https://stroblhof.com/','https://www.stroblhof.com/'),
('/reiseziele/suedtirol-italien','sidebar_04','legacy:https://josef.bz/de/hotel-hafling/1-0.html','https://www.josef.bz/de/hotel-hafling/1-0.html'),
('/reiseziele/suedtirol-italien','sidebar_05','legacy:https://villnerhof.com/','https://www.villnerhof.com/'),
('/reiseziele/suedtirol-italien','sidebar_06','legacy:https://steingarten.it/','https://www.steingarten.it/'),
('/reiseziele/suedtirol-italien','sidebar_07','legacy:https://kaiser-hans.com/','https://www.kaiser-hans.com/'),
('/reiseziele/suedtirol-italien','sidebar_08','legacy:https://almhof-call.com/','https://www.almhof-call.com/');

CREATE FUNCTION public.public_banner_search_contexts() RETURNS TABLE(scope text,key text,path text,label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $contexts$
 SELECT 'homepage'::text,NULL::text,'/'::text,'Startseite'::text
 UNION ALL SELECT 'experts_directory',NULL,'/unterkuenfte-a-z','Unterkünfte A–Z'
 UNION ALL SELECT 'portal_area',a.target_key,'/' || a.target_key,initcap(replace(coalesce(a.slug,a.section),'-',' ')) FROM public.ad_portal_areas a;
$contexts$;
REVOKE ALL ON FUNCTION public.public_banner_search_contexts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_banner_search_contexts() TO anon,authenticated;

CREATE FUNCTION public.public_banner_search_data() RETURNS TABLE (
 banner_key text, name text, body text, postal_code text, city text, categories text, path text, target_url text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $public_banners$
 WITH contexts AS (SELECT * FROM public.public_banner_search_contexts()), active AS (
 SELECT c.*,a.*,row_number() OVER(PARTITION BY c.path,a.placement ORDER BY a.id) AS priority
 FROM contexts c CROSS JOIN LATERAL public.get_active_ad_campaigns(c.scope,c.key) a
 ), visible AS (
 SELECT 'campaign:' || a.id::text AS banner_key,a.headline AS name,concat_ws(' ',a.body_text,a.label) AS body,
 a.path,a.target_url FROM active a WHERE a.priority=1 AND a.image_path IS NOT NULL
 AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ad-media' AND o.name=a.image_path)
 UNION ALL
 SELECT src.banner_key,m.legacy_name,c.label,c.path,coalesce(s.legacy_target_url,src.target_url)
 FROM contexts c CROSS JOIN unnest(ARRAY['top_banner','sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12']) slot(placement)
 LEFT JOIN public.ad_slot_presentations s ON s.target_type=c.scope AND s.target_key IS NOT DISTINCT FROM c.key AND s.placement=slot.placement
 JOIN public.ad_legacy_banner_search_sources src ON src.path=c.path AND src.placement=coalesce(s.legacy_placement,slot.placement)
 JOIN public.ad_banner_search_metadata m ON m.banner_key=src.banner_key
 WHERE NOT coalesce(s.legacy_hidden,false) AND NOT EXISTS(SELECT 1 FROM active a WHERE a.path=c.path AND a.placement=slot.placement)
 ) SELECT v.banner_key,v.name,v.body,coalesce(m.postal_code,''),coalesce(m.city,''),coalesce(terms.labels,''),v.path,v.target_url
 FROM visible v LEFT JOIN public.ad_banner_search_metadata m ON m.banner_key=v.banner_key
 LEFT JOIN LATERAL (SELECT string_agg(t.label,' ' ORDER BY t.term_key) AS labels FROM public.ad_banner_search_terms b JOIN public.travel_terms t USING(term_key) WHERE b.banner_key=v.banner_key) terms ON true;
$public_banners$;
REVOKE ALL ON FUNCTION public.public_banner_search_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_banner_search_data() TO anon,authenticated;

ALTER TABLE public.ad_banner_search_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_banner_search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_legacy_banner_search_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_banner_search_metadata,public.ad_banner_search_terms,public.ad_legacy_banner_search_sources FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.banner_search_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $admin$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid());
$admin$;
REVOKE ALL ON FUNCTION public.banner_search_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.banner_search_admin() TO anon,authenticated;
GRANT SELECT ON public.ad_banner_search_metadata,public.ad_banner_search_terms,public.ad_legacy_banner_search_sources TO anon,authenticated;
CREATE POLICY banner_metadata_read ON public.ad_banner_search_metadata FOR SELECT TO anon,authenticated USING (
 public.banner_search_admin() OR banner_key IN(SELECT b.banner_key FROM public.public_banner_search_data() b)
);
CREATE POLICY banner_terms_read ON public.ad_banner_search_terms FOR SELECT TO anon,authenticated USING (
 public.banner_search_admin() OR banner_key IN(SELECT b.banner_key FROM public.public_banner_search_data() b)
);
CREATE POLICY banner_sources_admin_read ON public.ad_legacy_banner_search_sources FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()));

CREATE FUNCTION public.save_ad_banner_search_metadata(p_campaign_id uuid,p_legacy_key text,p_name text,p_postal_code text,p_city text,p_term_keys text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $save_metadata$
DECLARE key text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF (p_campaign_id IS NULL)=(p_legacy_key IS NULL) OR char_length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 100
 OR char_length(coalesce(p_postal_code,''))>20 OR char_length(coalesce(p_city,''))>120
 OR concat_ws('',p_name,p_postal_code,p_city) ~ '[[:cntrl:]]' OR cardinality(p_term_keys)>50
 OR EXISTS(SELECT 1 FROM unnest(p_term_keys) term WHERE term IS NULL OR NOT EXISTS(SELECT 1 FROM public.travel_terms t WHERE t.term_key=term))
 THEN RAISE EXCEPTION 'Invalid metadata'; END IF;
 IF p_campaign_id IS NOT NULL THEN
  UPDATE public.company_ad_campaigns SET headline=btrim(p_name) WHERE id=p_campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown campaign'; END IF;
  key := 'campaign:' || p_campaign_id::text;
  INSERT INTO public.ad_banner_search_metadata(banner_key,campaign_id,postal_code,city) VALUES(key,p_campaign_id,btrim(coalesce(p_postal_code,'')),btrim(coalesce(p_city,'')))
  ON CONFLICT(banner_key) DO UPDATE SET postal_code=excluded.postal_code,city=excluded.city;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.ad_legacy_banner_search_sources WHERE banner_key=p_legacy_key) THEN RAISE EXCEPTION 'Unknown legacy creative'; END IF;
  key := p_legacy_key;
  UPDATE public.ad_banner_search_metadata SET legacy_name=btrim(p_name),postal_code=btrim(coalesce(p_postal_code,'')),city=btrim(coalesce(p_city,'')) WHERE banner_key=key;
 END IF;
 DELETE FROM public.ad_banner_search_terms WHERE banner_key=key;
 INSERT INTO public.ad_banner_search_terms SELECT key,term FROM (SELECT DISTINCT unnest(coalesce(p_term_keys,'{}'::text[])) AS term) t;
END;
$save_metadata$;
REVOKE ALL ON FUNCTION public.save_ad_banner_search_metadata(uuid,text,text,text,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ad_banner_search_metadata(uuid,text,text,text,text,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_public_portal(p_query text,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0,p_areas text[] DEFAULT '{}'::text[],p_catalog jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH query AS (SELECT public.portal_search_query(coalesce(p_query,'')) AS tsq,public.portal_search_normalize(left(btrim(coalesce(p_query,'')),160)) AS normalized),
 catalog AS (SELECT left(item->>'id',2048) AS id,item->>'type' AS type,left(item->>'title',300) AS title,
 left(item->>'body',10000) AS body,left(item->>'url',2048) AS url,left(item->>'context',160) AS context
 FROM (SELECT value AS item FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_catalog)='array' THEN p_catalog ELSE '[]'::jsonb END) LIMIT 256) input
 WHERE item->>'type' IN ('page','theme','destination','ad') AND jsonb_typeof(item)='object'),
 catalog_matches AS (SELECT c.id,c.type,c.title,c.url,c.context,
 ts_headline('pg_catalog.german',coalesce(c.body,''),q.tsq,'StartSel="",StopSel="",MaxWords=40,MinWords=15,MaxFragments=1') AS excerpt,
 CASE WHEN public.portal_search_normalize(c.title)=q.normalized THEN 1000 WHEN public.portal_search_normalize(c.title) LIKE q.normalized || '%' THEN 800
 WHEN public.portal_search_vector(c.title) @@ q.tsq THEN 600 ELSE 100 END +
 ts_rank_cd(setweight(public.portal_search_vector(coalesce(c.title,'')),'A') || setweight(public.portal_search_vector(coalesce(c.body,'')),'D'),q.tsq,32) AS rank
 FROM catalog c CROSS JOIN query q WHERE numnode(q.tsq)>0 AND public.portal_search_vector(concat_ws(' ',c.title,c.body)) @@ q.tsq),
 candidate_query AS (SELECT to_tsquery('pg_catalog.german',replace(tsq::text,' & ',' | ')) AS tsq FROM query),
 candidates AS (
 SELECT p.id FROM public.company_profiles p CROSS JOIN candidate_query q WHERE p.status='approved' AND public.portal_search_vector(
 coalesce(p.display_name,'') || ' ' || coalesce(p.tagline,'') || ' ' || coalesce(p.description,'') || ' ' || coalesce(p.business_areas,'') || ' ' ||
 coalesce(p.city,'') || ' ' || coalesce(p.region,'') || ' ' || coalesce(p.country,'')) @@ q.tsq
 UNION SELECT b.profile_id FROM public.profile_content_blocks b CROSS JOIN candidate_query q WHERE b.slot IS NULL AND b.type IN ('heading','text') AND public.portal_search_vector(coalesce(b.content->>'text','')) @@ q.tsq
 UNION SELECT b.profile_id FROM public.profile_content_blocks b CROSS JOIN candidate_query q WHERE b.slot IS NOT NULL AND public.portal_search_vector(coalesce(b.content->>'text','')) @@ q.tsq
 UNION SELECT b.profile_id FROM public.profile_content_block_images i JOIN public.profile_content_blocks b ON b.id=i.block_id CROSS JOIN candidate_query q WHERE public.portal_search_vector(coalesce(i.caption,'')) @@ q.tsq
 UNION SELECT pt.profile_id FROM public.company_profile_travel_terms pt JOIN public.travel_terms t USING(term_key) CROSS JOIN candidate_query q WHERE public.portal_search_vector(t.label || ' ' || replace(t.slug,'-',' ')) @@ q.tsq
 UNION SELECT p.id FROM public.company_profiles p CROSS JOIN candidate_query q WHERE p.status='approved' AND public.portal_search_vector(concat_ws(' ',p.street,p.postal_code,p.phone,p.public_email,p.website)) @@ q.tsq
 UNION SELECT '31ae7d1e-26a7-4161-8d14-f5ee4735f5d4'::uuid FROM candidate_query q WHERE public.portal_search_vector('Demo GmbH') @@ q.tsq
 ),
 matches AS (SELECT d.id,d.url,d.title,
 ts_headline('pg_catalog.german',concat_ws(' ',d.headings,d.body,d.location),q.tsq,'StartSel="",StopSel="",MaxWords=40,MinWords=15,MaxFragments=1') AS excerpt,
 (CASE WHEN public.portal_search_normalize(d.title)=q.normalized THEN 1000 WHEN public.portal_search_normalize(d.title) LIKE q.normalized || '%' THEN 800
 WHEN public.portal_search_vector(d.title) @@ q.tsq THEN 600 WHEN public.portal_search_vector(d.location) @@ q.tsq THEN 400
 WHEN public.portal_search_vector(d.terms) @@ q.tsq THEN 300 WHEN public.portal_search_vector(d.headings) @@ q.tsq THEN 200 ELSE 100 END
 + ts_rank_cd(d.document,q.tsq,32)) AS rank FROM public.portal_search_documents d JOIN candidates c ON c.id=d.id CROSS JOIN query q WHERE numnode(q.tsq)>0 AND d.document @@ q.tsq),
 contexts AS (SELECT scope,key,path FROM public.public_banner_search_contexts()),
 ads AS (SELECT c.path,a.id,a.placement,a.headline,a.body_text,a.target_url,a.image_path,
 a.image_path IS NULL OR EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='ad-media' AND o.name=a.image_path) AS image_available,
 CASE WHEN public.portal_search_vector(concat_ws(' ',a.headline,a.body_text)) @@ q.tsq THEN
 CASE WHEN public.portal_search_normalize(a.headline)=q.normalized THEN 1000 WHEN public.portal_search_vector(a.headline) @@ q.tsq THEN 600 ELSE 100 END
 + ts_rank_cd(setweight(public.portal_search_vector(a.headline),'A') || setweight(public.portal_search_vector(coalesce(a.body_text,'')),'D'),q.tsq,32) ELSE 0 END AS rank
 FROM contexts c CROSS JOIN LATERAL public.get_active_ad_campaigns(c.scope,c.key) a CROSS JOIN query q),
 settings AS (SELECT c.path,s.placement,s.size,s.legacy_hidden,s.legacy_target_url,s.legacy_placement,s.display_source FROM contexts c JOIN public.ad_slot_presentations s
 ON s.target_type=c.scope AND s.target_key IS NOT DISTINCT FROM c.key)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),'hits',coalesce((SELECT jsonb_agg(row_to_json(h)) FROM (
 SELECT * FROM matches ORDER BY rank DESC,title,id LIMIT greatest(1,least(coalesce(p_limit,100),1000)) OFFSET greatest(0,least(coalesce(p_offset,0),10000))) h),'[]'::jsonb),
 'catalog_hits',coalesce((SELECT jsonb_agg(row_to_json(c) ORDER BY c.rank DESC,c.title,c.id) FROM catalog_matches c),'[]'::jsonb),
 'banner_metadata',coalesce((SELECT jsonb_agg(row_to_json(b)) FROM (SELECT d.*, CASE WHEN public.portal_search_vector(concat_ws(' ',d.name,d.body,d.postal_code,d.city,d.categories)) @@ q.tsq THEN 100 + ts_rank_cd(public.portal_search_vector(concat_ws(' ',d.name,d.body,d.postal_code,d.city,d.categories)),q.tsq,32) ELSE 0 END AS rank FROM public.public_banner_search_data() d CROSS JOIN query q) b),'[]'::jsonb),
 'ads',coalesce((SELECT jsonb_agg(row_to_json(a)) FROM ads a),'[]'::jsonb),'presentations',coalesce((SELECT jsonb_agg(row_to_json(s)) FROM settings s),'[]'::jsonb));
$$;

COMMIT;
