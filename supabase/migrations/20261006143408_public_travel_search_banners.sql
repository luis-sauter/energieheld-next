BEGIN;
-- Read-only public projection. Definer is necessary for protected campaign/profile
-- association and presentation/metadata tables; public eligibility remains delegated
-- to the existing delivery/search functions. No table grants or writes are added.
CREATE FUNCTION public.public_travel_search_banners() RETURNS jsonb
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
  SELECT b.*,coalesce((SELECT jsonb_agg(t.term_key ORDER BY t.term_key)
   FROM public.ad_banner_search_terms t WHERE t.banner_key=b.banner_key),'[]'::jsonb) AS term_keys,
   (SELECT p.id FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id
    WHERE b.banner_key='campaign:' || a.id::text AND p.status='approved') AS profile_id
  FROM public.public_banner_search_data() b
 )
 SELECT jsonb_build_object(
  'ads',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.path,a.placement,a.id) FROM ads a),'[]'::jsonb),
  'presentations',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.path,s.placement) FROM settings s),'[]'::jsonb),
  'metadata',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.banner_key,m.path) FROM metadata m),'[]'::jsonb)
 );
$travel_banners$;
REVOKE ALL ON FUNCTION public.public_travel_search_banners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_travel_search_banners() TO anon,authenticated;
COMMIT;
