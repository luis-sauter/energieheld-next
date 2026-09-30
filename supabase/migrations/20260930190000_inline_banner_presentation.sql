-- Add presentation state to the existing advertising delivery, without rewriting inventory.
BEGIN;
CREATE TABLE public.ad_slot_presentations (
  target_type text NOT NULL CHECK (target_type IN ('homepage','experts_directory','portal_area')),
  target_key text REFERENCES public.ad_portal_areas(target_key),
  placement text NOT NULL CHECK (placement IN ('top_banner','sidebar_top','sidebar_middle','sidebar_bottom',
    'sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12')),
  size text NOT NULL DEFAULT 'large' CHECK (size IN ('small','medium','large')),
  legacy_hidden boolean NOT NULL DEFAULT false,
  legacy_target_url text CHECK (char_length(legacy_target_url)<=2048 AND legacy_target_url ~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'),
  CHECK ((target_type='portal_area') = (target_key IS NOT NULL)),
  UNIQUE NULLS NOT DISTINCT (target_type,target_key,placement)
);
ALTER TABLE public.ad_slot_presentations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_slot_presentation_read ON public.ad_slot_presentations FOR SELECT TO anon,authenticated USING (true);
REVOKE ALL ON public.ad_slot_presentations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ad_slot_presentations TO anon,authenticated;

CREATE FUNCTION public.save_inline_ad_presentation(p_target_type text,p_target_key text,p_placement text,
  p_campaign_id uuid,p_size text,p_legacy_hidden boolean,p_legacy_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041);
  IF p_campaign_id IS NOT NULL THEN
    PERFORM 1 FROM public.company_ad_campaigns WHERE id=p_campaign_id FOR UPDATE;
    IF (SELECT count(*) FROM public.company_ad_campaign_targets WHERE campaign_id=p_campaign_id)<>1
      OR NOT EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=p_campaign_id
        AND t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
        AND t.category_id IS NULL AND t.placement=p_placement)
    THEN RAISE EXCEPTION 'wrong banner context'; END IF;
  ELSIF EXISTS (SELECT 1 FROM public.get_active_ad_campaigns(p_target_type,p_target_key) WHERE placement=p_placement)
  THEN RAISE EXCEPTION 'banner changed'; END IF;
  INSERT INTO public.ad_slot_presentations(target_type,target_key,placement,size,legacy_hidden,legacy_target_url)
  VALUES(p_target_type,p_target_key,p_placement,p_size,p_legacy_hidden,p_legacy_url)
  ON CONFLICT(target_type,target_key,placement) DO UPDATE SET size=excluded.size,
    legacy_hidden=excluded.legacy_hidden,legacy_target_url=excluded.legacy_target_url;
END; $$;

-- Only the exact single-target editorial banner can be detached or made imageless.
-- Retain its historical campaign record; return the now-unreferenced image for existing safe cleanup.
CREATE FUNCTION public.remove_inline_ad_banner(p_campaign_id uuid,p_target_type text,p_target_key text,
  p_placement text,p_remove_banner boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; previous_image text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_remove_banner IS NULL THEN RAISE EXCEPTION 'invalid action'; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041);
  SELECT * INTO campaign FROM public.company_ad_campaigns WHERE id=p_campaign_id AND is_editorial FOR UPDATE;
  IF NOT FOUND OR (SELECT count(*) FROM public.company_ad_campaign_targets WHERE campaign_id=p_campaign_id)<>1
    OR NOT EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=p_campaign_id
      AND t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
      AND t.category_id IS NULL AND t.placement=p_placement)
  THEN RAISE EXCEPTION 'wrong banner context'; END IF;
  previous_image := campaign.image_path;
  UPDATE public.company_ad_campaigns SET status='draft',image_path=NULL,updated_at=clock_timestamp() WHERE id=p_campaign_id;
  INSERT INTO public.ad_slot_presentations(target_type,target_key,placement,legacy_hidden)
  VALUES(p_target_type,p_target_key,p_placement,true)
  ON CONFLICT(target_type,target_key,placement) DO UPDATE SET legacy_hidden=true;
  IF p_remove_banner THEN DELETE FROM public.company_ad_campaign_targets WHERE campaign_id=p_campaign_id; END IF;
  RETURN previous_image;
END; $$;
REVOKE ALL ON FUNCTION public.save_inline_ad_presentation(text,text,text,uuid,text,boolean,text),
  public.remove_inline_ad_banner(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_inline_ad_presentation(text,text,text,uuid,text,boolean,text),
  public.remove_inline_ad_banner(uuid,text,text,text,boolean) TO authenticated;
COMMIT;
