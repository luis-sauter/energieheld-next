-- Opt-in crop belongs to presentation, never booking or the source image.
BEGIN;
ALTER TABLE public.ad_slot_presentations
 ADD COLUMN focus_x numeric,
 ADD COLUMN focus_y numeric,
 ADD COLUMN zoom numeric,
 ADD COLUMN crop_reference text,
 ADD CONSTRAINT ad_presentation_crop_valid CHECK (
  (focus_x IS NULL AND focus_y IS NULL AND zoom IS NULL AND crop_reference IS NULL) OR
  (focus_x IS NOT NULL AND focus_y IS NOT NULL AND zoom IS NOT NULL AND crop_reference IS NOT NULL
   AND focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100 AND zoom BETWEEN 1 AND 3
   AND focus_x=round(focus_x,1) AND focus_y=round(focus_y,1) AND zoom=round(zoom,2)
   AND char_length(crop_reference) BETWEEN 1 AND 2048));
CREATE FUNCTION public.save_inline_ad_crop(p_target_type text,p_target_key text,p_placement text,
 p_campaign_id uuid,p_reference text,p_focus_x numeric,p_focus_y numeric,p_zoom numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041);
 IF p_campaign_id IS NOT NULL THEN
  SELECT * INTO campaign FROM public.company_ad_campaigns WHERE id=p_campaign_id FOR UPDATE;
  IF NOT FOUND OR campaign.image_path IS NULL
   OR (SELECT count(*) FROM public.company_ad_campaign_targets WHERE campaign_id=p_campaign_id)<>1
   OR NOT EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=p_campaign_id
    AND t.target_type=p_target_type AND t.target_key IS NOT DISTINCT FROM p_target_key
    AND t.category_id IS NULL AND t.placement=p_placement)
   OR p_reference IS DISTINCT FROM 'campaign:'||p_campaign_id::text||':'||campaign.image_path
  THEN RAISE EXCEPTION 'wrong banner context'; END IF;
 ELSE
  IF p_reference IS NULL OR p_reference NOT LIKE 'legacy:%'
   OR EXISTS (SELECT 1 FROM public.get_active_ad_campaigns(p_target_type,p_target_key) WHERE placement=p_placement)
   OR EXISTS (SELECT 1 FROM public.ad_slot_presentations WHERE target_type=p_target_type
    AND target_key IS NOT DISTINCT FROM p_target_key AND placement=p_placement AND legacy_hidden)
  THEN RAISE EXCEPTION 'banner changed'; END IF;
 END IF;
 -- Do not create a row with a default size that could change a legacy creative's envelope.
 UPDATE public.ad_slot_presentations SET focus_x=p_focus_x,focus_y=p_focus_y,zoom=p_zoom,
  crop_reference=CASE WHEN p_focus_x IS NULL AND p_focus_y IS NULL AND p_zoom IS NULL THEN NULL ELSE p_reference END
 WHERE target_type=p_target_type AND target_key IS NOT DISTINCT FROM p_target_key AND placement=p_placement;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing presentation'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.save_inline_ad_crop(text,text,text,uuid,text,numeric,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_inline_ad_crop(text,text,text,uuid,text,numeric,numeric,numeric) TO authenticated;
COMMIT;
