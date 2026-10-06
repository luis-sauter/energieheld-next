BEGIN;
-- Stable customer assignment; search geography never follows booking/presentation.
ALTER TABLE public.ad_banner_search_metadata
 ADD COLUMN advertiser_key text CHECK (char_length(advertiser_key) BETWEEN 1 AND 200),
 ADD COLUMN advertiser_name text NOT NULL DEFAULT '' CHECK (char_length(advertiser_name)<=120),
 ADD COLUMN advertiser_profile_id uuid REFERENCES public.company_profiles(id) ON DELETE SET NULL,
 ADD COLUMN commercial boolean NOT NULL DEFAULT true,
 ADD COLUMN primary_creative boolean NOT NULL DEFAULT false,
 ADD COLUMN destination_slugs text[] NOT NULL DEFAULT '{}',
 ADD COLUMN region text NOT NULL DEFAULT '' CHECK (char_length(region)<=120),
 ADD CONSTRAINT ad_search_destination_slugs CHECK (destination_slugs <@ ARRAY['deutschland','oesterreich','schweiz','suedtirol-italien']::text[]);
-- Exact exported URLs on the same host, verified against the existing inventory.
-- No name-based or cross-domain merge, and no geographical/taxonomy inference.
WITH proven(banner_key,advertiser_key,primary_creative) AS (VALUES
('legacy:https://neue-schaenke.de/','domain:neue-schaenke.de',true),
('legacy:https://city-apart-dresden.de/','domain:city-apart-dresden.de',true),
('legacy:https://haus-salzburg.de/','domain:haus-salzburg.de',true),
('legacy:https://ferienanlage-am-nationalpark.de/','domain:ferienanlage-am-nationalpark.de',true),
('legacy:https://annis-romantikhaeuschen.de/','domain:annis-romantikhaeuschen.de',true),
('legacy:https://fewo-sieber.de/','domain:fewo-sieber.de',true),
('legacy:https://rodelbahn-oderwitz.de/','domain:rodelbahn-oderwitz.de',true),
('legacy:https://ferienbauernhof-buechele.de/','domain:ferienbauernhof-buechele.de',true),
('legacy:https://barfusspark-schwackendorf.de/barfusspark/unser-barfusspark/','domain:barfusspark-schwackendorf.de',false),
('legacy:https://hotel-kronplatz.com/de/','domain:hotel-kronplatz.com',false),
('legacy:https://kesselgrub.at/de','domain:kesselgrub.at',false),
('legacy:https://ostseehotel-dierhagen.de/de/home','domain:ostseehotel-dierhagen.de',false),
('legacy:https://aparthotel-oberhof.de/','domain:aparthotel-oberhof.de',true),
('legacy:https://landhotel-schafhuber.at/wandern/','domain:landhotel-schafhuber.at',false),
('legacy:https://westerwald.info/','domain:westerwald.info',true),
('legacy:https://feldhof.com/','domain:feldhof.com',true),
('legacy:https://muehlvitalresort.de/','domain:muehlvitalresort.de',true),
('legacy:https://landhotel-talblick.de/aktiv-freizeit/wandern-nordic-walking','domain:landhotel-talblick.de',false),
('legacy:https://aktivitalhotel.de/region/aktivurlaub/nordic-walking','domain:aktivitalhotel.de',false),
('legacy:https://hoeflehner.com/Aktiv/Wandern','domain:hoeflehner.com',false),
('legacy:https://neckartalradweg-bw.de/','domain:neckartalradweg-bw.de',true),
('legacy:https://visitmosel.de/familienurlaub/radfahren','domain:visitmosel.de',false),
('legacy:https://zumgoldenenochsen.de/kultur-freizeit-and-erholung/','domain:zumgoldenenochsen.de',false),
('legacy:https://fischer-hopfensee.de/erleben/','domain:fischer-hopfensee.de',false),
('legacy:https://hotel-ruchti.de/urlaub-in-fuessen/fuessen','domain:hotel-ruchti.de',false),
('legacy:https://chiemsee-alpenland.de/','domain:chiemsee-alpenland.de',true),
('legacy:https://hotel-helmer.de/','domain:hotel-helmer.de',true),
('legacy:https://vulkanradweg.de/die-gastgeber/radtouren-fuer-sie-organisiert.html','domain:vulkanradweg.de',false),
('legacy:https://feldhof.com/aktivurlaub/wandern/','domain:feldhof.com',false),
('legacy:https://jaegeralpe.at/de/wanderhotel-best-alpine.html.iisnode','domain:jaegeralpe.at',false),
('legacy:https://sonnwies.com/familienhotel-suedtirol','domain:sonnwies.com',false),
('legacy:https://rhoen-park-hotel.de/familienhotel/','domain:rhoen-park-hotel.de',false),
('legacy:https://hoeflehner.com/Preise-Angebote/Familienurlaub-in-Oesterreich','domain:hoeflehner.com',false),
('legacy:https://godewind-thiessow.de/','domain:godewind-thiessow.de',true),
('legacy:https://luxoase.de/','domain:luxoase.de',true),
('legacy:https://camping-teichmann.de/','domain:camping-teichmann.de',true),
('legacy:https://hommage-hotels.com/grand-tirolia-kitzbuehel/golf-eichenheim','domain:hommage-hotels.com',false),
('legacy:https://johanneshof.com/de/','domain:johanneshof.com',false),
('legacy:https://thechediandermatt.com/de/explore/golfhotel-schweiz','domain:thechediandermatt.com',false),
('legacy:https://golfpanorama.ch/','domain:golfpanorama.ch',true),
('legacy:https://hofmaran.ch/','domain:hofmaran.ch',true),
('legacy:https://gnaid.it/','domain:gnaid.it',true),
('legacy:https://stroblhof.com/','domain:stroblhof.com',true),
('legacy:https://rcf-tauchreisen.de/','domain:rcf-tauchreisen.de',true),
('legacy:https://sub-aqua.de/','domain:sub-aqua.de',true),
('legacy:https://schoener-tauchen.de/','domain:schoener-tauchen.de',true),
('legacy:https://wernerlau.com/tauchen-malediven/','domain:wernerlau.com',false),
('legacy:https://tauchsport-egginger.de/','domain:tauchsport-egginger.de',true),
('legacy:https://beyond-diving.de/','domain:beyond-diving.de',true),
('legacy:https://sunandfun.com/tauchen/Tauchsafaris/','domain:sunandfun.com',false),
('legacy:https://belugareisen.de/','domain:belugareisen.de',true),
('legacy:https://wirodive.de/','domain:wirodive.de',true),
('legacy:https://hotelhirschen-bodensee.de/Hotel','domain:hotelhirschen-bodensee.de',false),
('legacy:https://alfsee.de/','domain:alfsee.de',true),
('legacy:https://roewers.de/','domain:roewers.de',true),
('legacy:https://schlosshotel-ralswiek.de/','domain:schlosshotel-ralswiek.de',true),
('legacy:https://camping-amrum.de/','domain:camping-amrum.de',true),
('legacy:https://bayregio.de/gastgeber/Campingplatz-Halbinsel-Burg','domain:bayregio.de',false),
('legacy:https://allweglehen.de/de/','domain:allweglehen.de',false),
('legacy:https://spacamping.de/de/angebote/angebote/angebot-zweisamkeit.php','domain:spacamping.de',false),
('legacy:https://alpenhotel-montafon.net/veranstaltungen-vorarlberg/hochzeitslocation/','domain:alpenhotel-montafon.net',false),
('legacy:https://nature-resort.at/willkommen.html','domain:nature-resort.at',false),
('legacy:https://mondschein.com/','domain:mondschein.com',true),
('legacy:https://rhoen-park-hotel.de/schwimmbad-sauna-fitness-wellness/','domain:rhoen-park-hotel.de',false),
('legacy:https://hoeflehner.com/Wellness/Naturelle-Behandlungen2','domain:hoeflehner.com',false),
('legacy:https://alpenhotel-montafon.net/','domain:alpenhotel-montafon.net',true),
('legacy:https://josef.bz/de/hotel-hafling/1-0.html','domain:josef.bz',false),
('legacy:https://hyatt.com/en-US/hotel/germany/lindner-hotel-cologne-city-plaza/cgnjd/special-events','domain:hyatt.com',false),
('legacy:https://dasbayrischzell.de/de/seminare/move-work','domain:dasbayrischzell.de',false),
('legacy:https://hotel-clemens-august.de/tagungshotel-im-muensterland','domain:hotel-clemens-august.de',false),
('legacy:https://landgut-ramshof.de/tagungen/','domain:landgut-ramshof.de',false),
('legacy:https://mintrops-landhotel.de/','domain:mintrops-landhotel.de',true),
('legacy:https://rhoen-park-hotel.de/tagungshotel/','domain:rhoen-park-hotel.de',false),
('legacy:https://landhotel-talblick.de/','domain:landhotel-talblick.de',true),
('legacy:https://hoeflehner.com/','domain:hoeflehner.com',true),
('legacy:https://haus-terra.at/','domain:haus-terra.at',true),
('legacy:https://laerchenhof.com/','domain:laerchenhof.com',true),
('legacy:https://villnerhof.com/','domain:villnerhof.com',true),
('legacy:https://steingarten.it/','domain:steingarten.it',true),
('legacy:https://kaiser-hans.com/','domain:kaiser-hans.com',true),
('legacy:https://almhof-call.com/','domain:almhof-call.com',true))
UPDATE public.ad_banner_search_metadata m SET advertiser_key=p.advertiser_key,
 advertiser_name=m.legacy_name,primary_creative=p.primary_creative FROM proven p WHERE m.banner_key=p.banner_key;
-- Current real external campaign destinations correspond exactly to these known hosts.
UPDATE public.ad_banner_search_metadata SET advertiser_key='domain:haus-salzburg.de',advertiser_name='Haus Salzburg Bad Füssing'
 WHERE campaign_id IN ('1168dee4-ad5b-4eff-8f2d-d14c34eeb774','85202f99-41b7-4640-82c8-f30506ca6e8f','59f3d06c-5df0-46b7-9d8d-97817dd7e36e');
UPDATE public.ad_banner_search_metadata SET advertiser_key='domain:ferienanlage-am-nationalpark.de',advertiser_name='Ferienanlage am Nationalpark'
 WHERE campaign_id IN ('3c1b0e6c-82a5-4b8c-a2f0-f8825d3b9b4a','12e4f8ba-cd8f-4764-ad60-09076f9e4083');
-- Existing table RLS remains admin-only. No new table grants or permissive policy.
CREATE OR REPLACE FUNCTION public.save_ad_banner_search_assignment(
 p_campaign_id uuid,p_legacy_key text,p_name text,p_postal_code text,p_city text,p_term_keys text[],
 p_advertiser_key text,p_advertiser_name text,p_profile_id uuid,p_commercial boolean,
 p_primary_creative boolean,p_destinations text[],p_region text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $assignment$
DECLARE key text; customer text; label text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF char_length(coalesce(p_advertiser_name,''))>120 OR char_length(coalesce(p_advertiser_key,''))>200
 OR char_length(coalesce(p_region,''))>120 OR concat_ws('',p_advertiser_key,p_advertiser_name,p_region) ~ '[[:cntrl:]]'
 OR NOT coalesce(p_destinations,'{}') <@ ARRAY['deutschland','oesterreich','schweiz','suedtirol-italien']::text[]
 OR array_position(p_destinations,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Invalid search assignment'; END IF;
 IF p_profile_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_profiles WHERE id=p_profile_id AND status='approved') THEN RAISE EXCEPTION 'Unknown public profile'; END IF;
 PERFORM public.save_ad_banner_search_metadata(p_campaign_id,p_legacy_key,p_name,p_postal_code,p_city,p_term_keys);
 key:=coalesce('campaign:'||p_campaign_id::text,p_legacy_key);
 customer:=nullif(btrim(p_advertiser_key),''); label:=btrim(coalesce(p_advertiser_name,''));
 IF p_profile_id IS NOT NULL THEN customer:='profile:'||p_profile_id::text;
 ELSIF customer LIKE 'profile:%' THEN RAISE EXCEPTION 'Profile identity requires profile';
 ELSIF customer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ad_banner_search_metadata WHERE advertiser_key=customer) THEN RAISE EXCEPTION 'Unknown advertiser';
 ELSIF customer IS NULL AND label<>'' THEN customer:='customer:'||gen_random_uuid()::text;
 END IF;
 UPDATE public.ad_banner_search_metadata SET advertiser_key=customer,advertiser_name=label,
 advertiser_profile_id=p_profile_id,commercial=coalesce(p_commercial,true),primary_creative=coalesce(p_primary_creative,false),
 destination_slugs=ARRAY(SELECT DISTINCT unnest(coalesce(p_destinations,'{}')) ORDER BY 1),region=btrim(coalesce(p_region,'')) WHERE banner_key=key;
 RETURN (SELECT jsonb_build_object('advertiser_key',advertiser_key,'advertiser_name',advertiser_name,'advertiser_profile_id',advertiser_profile_id,'commercial',commercial,'primary_creative',primary_creative,'destination_slugs',destination_slugs,'region',region) FROM public.ad_banner_search_metadata WHERE banner_key=key);
END;
$assignment$;
REVOKE ALL ON FUNCTION public.save_ad_banner_search_assignment(uuid,text,text,text,text,text[],text,text,uuid,boolean,boolean,text[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ad_banner_search_assignment(uuid,text,text,text,text,text[],text,text,uuid,boolean,boolean,text[],text) TO authenticated;
CREATE OR REPLACE FUNCTION public.public_travel_search_banners() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $travel_banners$
 WITH contexts AS (SELECT * FROM public.public_banner_search_contexts()),
 ads AS (
  SELECT c.path,a.id,a.placement,a.headline,a.body_text,a.target_url,a.image_path,
   EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ad-media' AND o.name=a.image_path) AS image_available
  FROM contexts c CROSS JOIN LATERAL public.get_active_ad_campaigns(c.scope,c.key) a
 ),
 settings AS (
  SELECT c.path,s.placement,s.size,s.legacy_hidden,s.legacy_target_url,s.legacy_placement,s.display_source,
   s.focus_x,s.focus_y,s.zoom,s.crop_reference
  FROM contexts c JOIN public.ad_slot_presentations s
   ON s.target_type=c.scope AND s.target_key IS NOT DISTINCT FROM c.key
 ),
 metadata AS (
  SELECT b.*,CASE WHEN m.advertiser_profile_id IS NULL THEN m.advertiser_key WHEN EXISTS(SELECT 1 FROM public.company_profiles p WHERE p.id=m.advertiser_profile_id AND p.status='approved') THEN 'profile:'||m.advertiser_profile_id::text END AS advertiser_key,m.advertiser_name,m.commercial,m.primary_creative,m.destination_slugs,m.region,coalesce((SELECT jsonb_agg(t.term_key ORDER BY t.term_key)
   FROM public.ad_banner_search_terms t WHERE t.banner_key=b.banner_key),'[]'::jsonb) AS term_keys,
   coalesce((SELECT p.id FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id
    WHERE b.banner_key='campaign:' || a.id::text AND p.status='approved'),
    (SELECT p.id FROM public.company_profiles p WHERE p.id=m.advertiser_profile_id AND p.status='approved')) AS profile_id
  FROM public.public_banner_search_data() b LEFT JOIN public.ad_banner_search_metadata m ON m.banner_key=b.banner_key
 )
 SELECT jsonb_build_object(
  'ads',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.path,a.placement,a.id) FROM ads a),'[]'::jsonb),
  'presentations',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.path,s.placement) FROM settings s),'[]'::jsonb),
  'terms',coalesce((SELECT jsonb_agg(jsonb_build_object('term_key',t.term_key,'dimension',t.dimension,'slug',t.slug,'label',t.label) ORDER BY t.term_key)
   FROM public.travel_terms t WHERE t.term_key IN (SELECT jsonb_array_elements_text(m.term_keys) FROM metadata m)),'[]'::jsonb),
  'metadata',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.banner_key,m.path) FROM metadata m),'[]'::jsonb)
 );
$travel_banners$;
REVOKE ALL ON FUNCTION public.public_travel_search_banners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_travel_search_banners() TO anon,authenticated;
-- Preserve the new search fields when the existing lifecycle copies metadata.
CREATE OR REPLACE FUNCTION public.admin_ad_lifecycle(p_id uuid,p_action text,p_image_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.company_ad_campaigns; new_id uuid; group_id uuid; BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 PERFORM pg_advisory_xact_lock(20260917,203041);
 SELECT * INTO original FROM public.company_ad_campaigns WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 IF p_action='archive' THEN
  IF original.archived_at IS NULL THEN UPDATE public.company_ad_campaigns SET archived_at=clock_timestamp() WHERE id=p_id; END IF;
 ELSIF p_action='reuse' THEN
  IF original.archived_at IS NULL OR original.deletion_requested_at IS NOT NULL THEN RAISE EXCEPTION 'Archive required'; END IF;
  group_id := coalesce(original.lifecycle_group_id,original.id);
  IF EXISTS (SELECT 1 FROM public.company_ad_campaigns a
    WHERE coalesce(a.lifecycle_group_id,a.id)=group_id
      AND a.archived_at IS NULL) THEN RAISE EXCEPTION 'Banner already reused'; END IF;
  IF original.lifecycle_group_id IS NULL THEN
    UPDATE public.company_ad_campaigns SET lifecycle_group_id=group_id WHERE id=p_id;
  END IF;
  INSERT INTO public.company_ad_campaigns(profile_id,is_editorial,internal_name,headline,body_text,target_url,lifecycle_group_id)
  VALUES(original.profile_id,original.is_editorial,original.internal_name,original.headline,original.body_text,original.target_url,group_id) RETURNING id INTO new_id;
  INSERT INTO public.ad_banner_search_metadata(banner_key,campaign_id,postal_code,city,advertiser_key,advertiser_name,advertiser_profile_id,commercial,primary_creative,destination_slugs,region)
  SELECT 'campaign:'||new_id::text,new_id,postal_code,city,advertiser_key,advertiser_name,advertiser_profile_id,commercial,primary_creative,destination_slugs,region FROM public.ad_banner_search_metadata WHERE campaign_id=p_id;
  INSERT INTO public.ad_banner_search_terms(banner_key,term_key)
  SELECT 'campaign:'||new_id::text,term_key FROM public.ad_banner_search_terms WHERE banner_key='campaign:'||p_id::text;
  RETURN new_id;
 ELSIF p_action='attach_copy' THEN
  IF original.archived_at IS NOT NULL OR original.status<>'draft' OR original.image_path IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.company_ad_campaign_targets WHERE campaign_id=p_id)
    OR p_image_path IS NULL OR p_image_path !~ ('^campaigns/'||p_id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$')
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name=p_image_path)
  THEN RAISE EXCEPTION 'Invalid draft creative'; END IF;
  UPDATE public.company_ad_campaigns SET image_path=p_image_path WHERE id=p_id;
 ELSIF p_action='prepare_delete' THEN
  IF original.archived_at IS NULL THEN RAISE EXCEPTION 'Archive required'; END IF;
  UPDATE public.company_ad_campaigns SET deletion_requested_at=coalesce(deletion_requested_at,clock_timestamp()) WHERE id=p_id;
 ELSIF p_action='delete' THEN
  IF original.archived_at IS NULL OR original.deletion_requested_at IS NULL THEN RAISE EXCEPTION 'Confirmed archive deletion required'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name LIKE 'campaigns/'||p_id::text||'/creative/%') THEN RAISE EXCEPTION 'Clean up media first'; END IF;
  -- Crop references describe creatives, while slot identity/size/order stay untouched.
  UPDATE public.ad_slot_presentations SET focus_x=NULL,focus_y=NULL,zoom=NULL,crop_reference=NULL
   WHERE crop_reference LIKE 'campaign:'||p_id::text||':%';
  DELETE FROM public.company_ad_campaigns WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid action'; END IF;
 RETURN p_id;
END; $$;
REVOKE ALL ON FUNCTION public.admin_ad_lifecycle(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ad_lifecycle(uuid,text,text) TO authenticated;

COMMIT;
