-- Local only until the Reiseportal area targeting migration is approved for Cloud.
-- Existing campaigns, media, target pairs and RLS remain intact.
BEGIN;
CREATE TABLE public.ad_portal_areas (
  target_key text PRIMARY KEY,
  section text NOT NULL CHECK (section IN ('mottoreisen','reiseziele')),
  slug text,
  UNIQUE NULLS NOT DISTINCT (section,slug),
  CHECK (target_key = section || CASE WHEN slug IS NULL THEN '' ELSE '/' || slug END)
);
ALTER TABLE public.ad_portal_areas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_portal_areas FROM PUBLIC, anon, authenticated;
INSERT INTO public.ad_portal_areas(target_key,section,slug) VALUES
  ('mottoreisen','mottoreisen',NULL),('reiseziele','reiseziele',NULL),
  ('reiseziele/deutschland','reiseziele','deutschland'),
  ('reiseziele/oesterreich','reiseziele','oesterreich'),
  ('reiseziele/schweiz','reiseziele','schweiz'),
  ('reiseziele/suedtirol-italien','reiseziele','suedtirol-italien');
-- Theme slugs come from the existing controlled taxonomy, never a parallel list.
INSERT INTO public.ad_portal_areas(target_key,section,slug)
SELECT 'mottoreisen/' || slug,'mottoreisen',slug FROM public.travel_terms WHERE dimension='theme';
ALTER TABLE public.company_ad_campaign_targets
  ADD COLUMN target_key text REFERENCES public.ad_portal_areas(target_key);
ALTER TABLE public.company_ad_campaign_targets
  DROP CONSTRAINT company_ad_campaign_targets_target_type_check,
  ADD CONSTRAINT company_ad_campaign_targets_target_type_check
    CHECK (target_type IN ('homepage','experts_directory','trade','portal_area'));
ALTER TABLE public.company_ad_campaign_targets DROP CONSTRAINT ad_target_shape;
ALTER TABLE public.company_ad_campaign_targets ADD CONSTRAINT ad_target_shape CHECK (
  (target_type IN ('homepage','experts_directory') AND category_id IS NULL AND target_key IS NULL)
  OR (target_type='trade' AND category_id IS NOT NULL AND target_key IS NULL AND public.is_energyheld_category_id(category_id))
  OR (target_type='portal_area' AND category_id IS NULL AND target_key IS NOT NULL));
ALTER TABLE public.company_ad_campaign_targets DROP CONSTRAINT ad_target_pair_unique;
ALTER TABLE public.company_ad_campaign_targets ADD CONSTRAINT ad_target_pair_unique
  UNIQUE NULLS NOT DISTINCT (campaign_id,target_type,category_id,target_key,placement);
CREATE INDEX ad_portal_target_slot_idx ON public.company_ad_campaign_targets(target_key,placement,campaign_id)
  WHERE target_type='portal_area';
CREATE OR REPLACE FUNCTION public.save_ad_campaign(p_campaign_id uuid,p_data jsonb,p_submit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; media text; destination text; targets jsonb; is_admin boolean;
BEGIN
 is_admin := auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid());
 IF is_admin AND current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 IF is_admin THEN PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041); END IF;
 SELECT a.* INTO campaign FROM public.company_ad_campaigns a
 JOIN public.company_profiles p ON p.id=a.profile_id
 JOIN public.companies c ON c.id=p.company_id
 WHERE a.id=p_campaign_id AND (c.owner_user_id=auth.uid() OR is_admin) FOR UPDATE OF a;
 IF NOT FOUND OR (NOT is_admin AND campaign.status NOT IN ('draft','rejected')) THEN RAISE EXCEPTION 'not editable'; END IF;
 targets := p_data->'targets';
 IF targets IS NULL OR jsonb_typeof(targets)<>'array'
   OR jsonb_array_length(targets)<1 OR jsonb_array_length(targets)>128
 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(targets) t WHERE jsonb_typeof(t)<>'object'
   OR t->>'target_type' NOT IN ('homepage','experts_directory','trade','portal_area')
   OR (t ? 'placement' AND t->>'placement' NOT IN ('top_banner','sidebar_top','sidebar_middle','sidebar_bottom',
     'sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08',
     'sidebar_09','sidebar_10','sidebar_11','sidebar_12'))
   OR (t->>'target_type' IN ('homepage','experts_directory') AND (t->>'category_id' IS NOT NULL OR t->>'target_key' IS NOT NULL))
   OR (t->>'target_type'='trade' AND (t->>'category_id' IS NULL OR t->>'target_key' IS NOT NULL OR NOT public.is_energyheld_category_id(t->>'category_id')))
   OR (t->>'target_type'='portal_area' AND (t->>'category_id' IS NOT NULL OR NOT EXISTS
     (SELECT 1 FROM public.ad_portal_areas area WHERE area.target_key=t->>'target_key')))
 ) THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(targets)) <>
    (SELECT count(DISTINCT (t->>'target_type',t->>'category_id',t->>'target_key',t->>'placement')) FROM jsonb_array_elements(targets) t)
 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 PERFORM 1 FROM public.company_profile_categories pc
 WHERE pc.profile_id=campaign.profile_id AND pc.category_id IN
   (SELECT t->>'category_id' FROM jsonb_array_elements(targets) t) FOR SHARE;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(targets) t WHERE t->>'target_type'='trade'
   AND NOT EXISTS (SELECT 1 FROM public.company_profile_categories pc
     WHERE pc.profile_id=campaign.profile_id AND pc.category_id=t->>'category_id'))
 THEN RAISE EXCEPTION 'ad_target_not_assigned'; END IF;
 media := nullif(p_data->>'image_path',''); destination := btrim(p_data->>'target_url');
 IF coalesce(length(btrim(p_data->>'internal_name')),0)=0
   OR coalesce(length(btrim(p_data->>'headline')),0)=0
   OR destination IS NULL
   OR destination !~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
   OR char_length(coalesce(p_data->>'contact_name',''))>120
   OR char_length(coalesce(p_data->>'contact_phone',''))>60
   OR char_length(coalesce(p_data->>'contact_email',''))>254
   OR (nullif(p_data->>'contact_email','') IS NOT NULL
     AND p_data->>'contact_email' !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 THEN RAISE EXCEPTION 'invalid creative'; END IF;
 IF media IS NOT NULL AND (media !~ ('^campaigns/'||campaign.id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$')
   OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name=media))
 THEN RAISE EXCEPTION 'invalid media'; END IF;
 IF campaign.status IN ('approved','paused') AND media IS NULL THEN RAISE EXCEPTION 'image required'; END IF;
 DELETE FROM public.company_ad_campaign_targets WHERE campaign_id=campaign.id;
 INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type,category_id,target_key,placement)
 SELECT campaign.id,t->>'target_type',t->>'category_id',t->>'target_key',t->>'placement'
 FROM jsonb_array_elements(targets) t;
 UPDATE public.company_ad_campaigns SET
   internal_name=btrim(p_data->>'internal_name'),
   placement=coalesce(targets->0->>'placement',p_data->>'placement',campaign.placement),
   requested_start_date=(p_data->>'requested_start_date')::date,
   requested_end_date=(p_data->>'requested_end_date')::date,
   headline=btrim(p_data->>'headline'),
   body_text=nullif(btrim(p_data->>'body_text'),''),
   target_url=destination,image_path=media,
   contact_name=nullif(btrim(p_data->>'contact_name'),''),
   contact_phone=nullif(btrim(p_data->>'contact_phone'),''),
   contact_email=nullif(btrim(p_data->>'contact_email'),''),
   status=CASE WHEN is_admin AND campaign.status NOT IN ('draft','rejected') THEN campaign.status WHEN p_submit THEN 'pending' ELSE 'draft' END,
   approved_start_date=CASE WHEN is_admin AND campaign.status IN ('approved','paused') THEN (p_data->>'requested_start_date')::date ELSE campaign.approved_start_date END,
   approved_end_date=CASE WHEN is_admin AND campaign.status IN ('approved','paused') THEN (p_data->>'requested_end_date')::date ELSE campaign.approved_end_date END,
   submitted_at=CASE WHEN p_submit AND campaign.status IN ('draft','rejected') THEN clock_timestamp() ELSE submitted_at END,
   updated_at=clock_timestamp()
 WHERE id=campaign.id;
 IF is_admin AND campaign.status='approved' AND EXISTS (
   SELECT 1 FROM public.company_ad_campaigns a
   JOIN public.company_ad_campaign_targets booked ON booked.campaign_id=a.id
   JOIN public.company_ad_campaign_targets requested ON requested.campaign_id=campaign.id
     AND requested.target_type=booked.target_type
     AND requested.category_id IS NOT DISTINCT FROM booked.category_id
     AND requested.target_key IS NOT DISTINCT FROM booked.target_key
     AND coalesce(requested.placement,campaign.placement)=coalesce(booked.placement,a.placement)
   WHERE a.id<>campaign.id AND a.status='approved'
     AND a.approved_start_date<=(p_data->>'requested_end_date')::date
     AND a.approved_end_date>=(p_data->>'requested_start_date')::date
 ) THEN RAISE EXCEPTION 'ad_booking_conflict'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.review_ad_campaign(p_campaign_id uuid,p_decision text,p_start date DEFAULT NULL,p_end date DEFAULT NULL,p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; start_day date; end_day date;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approve','reject','pause','resume') THEN RAISE EXCEPTION 'invalid decision'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041);
 SELECT * INTO campaign FROM public.company_ad_campaigns WHERE id=p_campaign_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
 IF (p_decision IN ('approve','reject') AND campaign.status<>'pending')
   OR (p_decision='pause' AND campaign.status<>'approved')
   OR (p_decision='resume' AND campaign.status<>'paused') THEN RAISE EXCEPTION 'invalid transition'; END IF;
 IF char_length(p_note)>2000 THEN RAISE EXCEPTION 'invalid note'; END IF;
 IF p_decision IN ('approve','resume') THEN
   start_day:=CASE WHEN p_decision='resume' THEN campaign.approved_start_date ELSE p_start END;
   end_day:=CASE WHEN p_decision='resume' THEN campaign.approved_end_date ELSE p_end END;
   IF start_day IS NULL OR end_day IS NULL OR end_day<start_day THEN RAISE EXCEPTION 'invalid dates'; END IF;
   IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name=campaign.image_path) THEN RAISE EXCEPTION 'image required'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.company_ad_campaign_targets WHERE campaign_id=campaign.id) THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
   PERFORM 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id
     AND pc.category_id IN (SELECT category_id FROM public.company_ad_campaign_targets
       WHERE campaign_id=campaign.id AND target_type='trade') FOR SHARE;
   IF EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=campaign.id AND t.target_type='trade'
     AND NOT EXISTS (SELECT 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id AND pc.category_id=t.category_id))
   THEN RAISE EXCEPTION 'ad_target_not_assigned'; END IF;
   IF EXISTS (SELECT 1 FROM public.company_ad_campaigns a
     JOIN public.company_ad_campaign_targets booked ON booked.campaign_id=a.id
     JOIN public.company_ad_campaign_targets requested ON requested.campaign_id=campaign.id
       AND requested.target_type=booked.target_type
       AND requested.category_id IS NOT DISTINCT FROM booked.category_id
       AND requested.target_key IS NOT DISTINCT FROM booked.target_key
       AND coalesce(requested.placement,campaign.placement)=coalesce(booked.placement,a.placement)
     WHERE a.id<>campaign.id AND a.status='approved'
       AND a.approved_start_date<=end_day AND a.approved_end_date>=start_day)
   THEN RAISE EXCEPTION 'ad_booking_conflict'; END IF;
 END IF;
 UPDATE public.company_ad_campaigns SET
 status=CASE p_decision WHEN 'approve' THEN 'approved' WHEN 'resume' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'paused' END,
 approved_start_date=CASE WHEN p_decision IN ('approve','resume') THEN start_day ELSE approved_start_date END,
 approved_end_date=CASE WHEN p_decision IN ('approve','resume') THEN end_day ELSE approved_end_date END,
 admin_note=nullif(btrim(p_note),''),reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),updated_at=clock_timestamp()
 WHERE id=campaign.id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_active_ad_campaigns(p_scope_type text,p_category_id text DEFAULT NULL)
RETURNS TABLE(id uuid,placement text,headline text,body_text text,target_url text,image_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.id,coalesce(t.placement,a.placement),a.headline,a.body_text,a.target_url,a.image_path
 FROM public.company_ad_campaigns a
 JOIN public.company_ad_campaign_targets t ON t.campaign_id=a.id
 WHERE a.status='approved'
   AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date
   AND ((p_scope_type='homepage' AND p_category_id IS NULL AND t.target_type='homepage')
     OR (p_scope_type='experts_directory' AND p_category_id IS NULL AND t.target_type='experts_directory')
     OR (p_scope_type='portal_area' AND t.target_type='portal_area' AND t.target_key=p_category_id)
     OR (p_scope_type='trade' AND public.is_energyheld_category_id(p_category_id)
       AND t.target_type='trade' AND t.category_id=p_category_id
       AND EXISTS (SELECT 1 FROM public.company_profile_categories pc
         WHERE pc.profile_id=a.profile_id AND pc.category_id=t.category_id)))
 ORDER BY coalesce(t.placement,a.placement),a.id;
$$;

DROP FUNCTION public.get_ad_slot_availability(date,date,uuid);
CREATE FUNCTION public.get_ad_slot_availability(p_start date,p_end date,p_exclude_campaign_id uuid DEFAULT NULL)
RETURNS TABLE(target_type text,category_id text,target_key text,placement text,status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<p_start THEN RAISE EXCEPTION 'invalid dates'; END IF;
 IF p_exclude_campaign_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id
   JOIN public.companies c ON c.id=p.company_id
   WHERE a.id=p_exclude_campaign_id AND (c.owner_user_id=auth.uid()
     OR EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
 ) THEN p_exclude_campaign_id := NULL; END IF;
 RETURN QUERY SELECT DISTINCT t.target_type,t.category_id,t.target_key,coalesce(t.placement,a.placement),a.status
 FROM public.company_ad_campaigns a
 JOIN public.company_ad_campaign_targets t ON t.campaign_id=a.id
 WHERE a.id IS DISTINCT FROM p_exclude_campaign_id
 AND ((a.status='approved' AND a.approved_start_date<=p_end AND a.approved_end_date>=p_start)
   OR (a.status='pending' AND a.requested_start_date<=p_end AND a.requested_end_date>=p_start));
END; $$;
REVOKE ALL ON FUNCTION public.get_ad_slot_availability(date,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_ad_slot_availability(date,date,uuid) TO authenticated;

COMMIT;
