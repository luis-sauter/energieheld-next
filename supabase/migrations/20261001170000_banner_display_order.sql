-- Booking targets remain immutable during display reordering.
BEGIN;
ALTER TABLE public.ad_slot_presentations ADD COLUMN display_source text
  CHECK (display_source IN ('sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05',
    'sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12'));
ALTER TABLE public.ad_slot_presentations ADD CONSTRAINT premium_display_fixed
  CHECK (placement <> 'top_banner' OR display_source IS NULL);

CREATE OR REPLACE FUNCTION public.reorder_inline_ad_contents(p_target_type text,p_target_key text,
  p_sources text[],p_expected text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  positions text[] := ARRAY['sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05',
    'sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12'];
  current_sources text[] := ARRAY[]::text[]; tokens text[] := ARRAY[]::text[];
  source text; token text; campaign_id uuid; setting public.ad_slot_presentations; i integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
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
  FOR i IN 1..12 LOOP
    SELECT coalesce(display_source,positions[i]) INTO source FROM public.ad_slot_presentations
      WHERE target_type=p_target_type AND target_key IS NOT DISTINCT FROM p_target_key AND placement=positions[i];
    source := coalesce(source,positions[i]);
    current_sources := array_append(current_sources,source);
    SELECT * INTO setting FROM public.ad_slot_presentations
      WHERE target_type=p_target_type AND target_key IS NOT DISTINCT FROM p_target_key AND placement=source;
    -- Match the current public creative or the admin's existing unpublished editorial draft.
    SELECT a.id INTO campaign_id FROM public.company_ad_campaigns a
      JOIN public.company_ad_campaign_targets t ON t.campaign_id=a.id
      WHERE t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
        AND t.category_id IS NULL AND t.placement=source
        AND ((a.status='approved' AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date)
          OR (a.is_editorial AND a.status<>'approved' AND (a.status<>'paused' OR a.approved_end_date >= (now() AT TIME ZONE 'Europe/Berlin')::date)))
      ORDER BY (a.status='approved') DESC,a.created_at DESC,a.id LIMIT 1;
    token := coalesce(campaign_id::text,CASE WHEN NOT coalesce(setting.legacy_hidden,false)
      AND array_position(positions,coalesce(setting.legacy_placement,source))<=10
      THEN 'legacy:'||coalesce(setting.legacy_placement,source) ELSE '' END);
    tokens := array_append(tokens,token);
  END LOOP;
  IF (SELECT count(DISTINCT x) FROM unnest(current_sources) x WHERE x=ANY(positions))<>12
  THEN RAISE EXCEPTION 'invalid display mapping'; END IF;
  FOR i IN 1..12 LOOP
    IF p_sources[i]=positions[i] THEN CONTINUE; END IF;
    IF p_expected[i] IS DISTINCT FROM tokens[i] THEN RAISE EXCEPTION 'banner changed; reload'; END IF;
  END LOOP;
  -- Compose the display permutation. No campaign, target, legacy, URL, size or media mutation.
  FOR i IN 1..12 LOOP
    IF p_sources[i]=positions[i] THEN CONTINUE; END IF;
    source := current_sources[array_position(positions,p_sources[i])];
    INSERT INTO public.ad_slot_presentations(target_type,target_key,placement,display_source)
      VALUES(p_target_type,p_target_key,positions[i],source)
      ON CONFLICT(target_type,target_key,placement) DO UPDATE SET display_source=excluded.display_source;
  END LOOP;
END; $$;
-- Existing RPC grants and RLS are deliberately unchanged; direct writes remain forbidden.
COMMIT;
