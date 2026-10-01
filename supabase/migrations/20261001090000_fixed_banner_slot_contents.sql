-- Positions stay fixed. Only the existing content assignments may be permuted.
BEGIN;
ALTER TABLE public.ad_slot_presentations ADD COLUMN legacy_placement text
  CHECK (legacy_placement IN ('sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05',
    'sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12'));

CREATE FUNCTION public.reorder_inline_ad_contents(p_target_type text,p_target_key text,
  p_sources text[],p_expected text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  positions text[] := ARRAY['sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05',
    'sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12'];
  contents jsonb := '{}'::jsonb; setting public.ad_slot_presentations;
  i integer; source text; content jsonb; content_campaign uuid; campaign_count integer; token text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041);
  IF p_target_type IS NULL OR p_target_type NOT IN ('homepage','experts_directory','portal_area')
    OR (p_target_type='portal_area') IS DISTINCT FROM (p_target_key IS NOT NULL)
    OR (p_target_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ad_portal_areas WHERE target_key=p_target_key))
  THEN RAISE EXCEPTION 'invalid context'; END IF;
  IF cardinality(p_sources) IS DISTINCT FROM 12 OR cardinality(p_expected) IS DISTINCT FROM 12
    OR array_ndims(p_sources) IS DISTINCT FROM 1 OR array_lower(p_sources,1) IS DISTINCT FROM 1
    OR array_ndims(p_expected) IS DISTINCT FROM 1 OR array_lower(p_expected,1) IS DISTINCT FROM 1
    OR (SELECT count(DISTINCT x) FROM unnest(p_sources) x WHERE x=ANY(positions))<>12
  THEN RAISE EXCEPTION 'invalid contents'; END IF;

  -- Do not move contracted/company/shared banners, including future bookings.
  IF EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t
    JOIN public.company_ad_campaigns a ON a.id=t.campaign_id
    WHERE t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
      AND t.category_id IS NULL AND t.placement=ANY(positions)
      AND positions[array_position(p_sources,t.placement)]<>t.placement
      AND (NOT a.is_editorial OR (SELECT count(*) FROM public.company_ad_campaign_targets WHERE campaign_id=a.id)<>1))
  THEN RAISE EXCEPTION 'company or shared banner cannot move'; END IF;
  PERFORM 1 FROM public.company_ad_campaigns a WHERE EXISTS (
    SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=a.id
      AND t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key AND t.category_id IS NULL)
    FOR UPDATE;
  FOR i IN 1..12 LOOP
    source := positions[i];
    SELECT * INTO setting FROM public.ad_slot_presentations
      WHERE target_type=p_target_type AND target_key IS NOT DISTINCT FROM p_target_key AND placement=source;
    SELECT count(*),min(t.campaign_id::text)::uuid INTO campaign_count,content_campaign
      FROM public.company_ad_campaign_targets t JOIN public.company_ad_campaigns a ON a.id=t.campaign_id
      WHERE t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
        AND t.category_id IS NULL AND t.placement=source;
    IF positions[array_position(p_sources,source)]<>source THEN
      IF campaign_count>1 THEN RAISE EXCEPTION 'multiple campaigns cannot move'; END IF;
      token := coalesce(content_campaign::text, CASE WHEN NOT coalesce(setting.legacy_hidden,false)
        AND array_position(positions,coalesce(setting.legacy_placement,source))<=10
        THEN 'legacy:'||coalesce(setting.legacy_placement,source) ELSE '' END);
      IF p_expected[i] IS DISTINCT FROM token THEN RAISE EXCEPTION 'banner changed; reload'; END IF;
    END IF;
    contents := contents || jsonb_build_object(source,jsonb_build_object(
      'size',coalesce(setting.size,'large'),
      'hidden',coalesce(setting.legacy_hidden,false) OR content_campaign IS NOT NULL,
      'url',setting.legacy_target_url,'legacy',coalesce(setting.legacy_placement,source)));
  END LOOP;

  -- Bijective assignment keeps occupancy and periods together; no file/path is touched.
  UPDATE public.company_ad_campaign_targets t
    SET placement=positions[array_position(p_sources,t.placement)]
    WHERE t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
      AND t.category_id IS NULL AND t.placement=ANY(positions)
      AND positions[array_position(p_sources,t.placement)]<>t.placement;
  UPDATE public.company_ad_campaigns a SET placement=t.placement,updated_at=clock_timestamp()
    FROM public.company_ad_campaign_targets t
    WHERE t.campaign_id=a.id AND t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
      AND t.category_id IS NULL AND t.placement=ANY(positions) AND a.is_editorial
      AND p_sources[array_position(positions,t.placement)]<>t.placement
      AND (SELECT count(*) FROM public.company_ad_campaign_targets WHERE campaign_id=a.id)=1
      AND a.placement<>t.placement;
  FOR i IN 1..12 LOOP
    -- Leave unchanged slots byte-for-byte untouched.
    IF p_sources[i]=positions[i] THEN CONTINUE; END IF;
    content := contents->p_sources[i];
    INSERT INTO public.ad_slot_presentations(target_type,target_key,placement,size,legacy_hidden,legacy_target_url,legacy_placement)
      VALUES(p_target_type,p_target_key,positions[i],content->>'size',(content->>'hidden')::boolean,
        content->>'url',content->>'legacy')
      ON CONFLICT(target_type,target_key,placement) DO UPDATE SET size=excluded.size,
        legacy_hidden=excluded.legacy_hidden,legacy_target_url=excluded.legacy_target_url,legacy_placement=excluded.legacy_placement;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.reorder_inline_ad_contents(text,text,text[],text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_inline_ad_contents(text,text,text[],text[]) TO authenticated;
COMMIT;
