-- LOCAL PREPARATION ONLY. Cloud application requires separate explicit approval.
-- Same campaigns, targets, immutable ad-media paths and publication/conflict RPCs.
-- No existing campaign, target, profile or Storage object is rewritten.
BEGIN;

ALTER TABLE public.company_ad_campaigns
  ADD COLUMN is_editorial boolean NOT NULL DEFAULT false,
  ALTER COLUMN profile_id DROP NOT NULL,
  ADD CONSTRAINT ad_campaign_profile_binding CHECK (is_editorial = (profile_id IS NULL));
COMMENT ON COLUMN public.company_ad_campaigns.is_editorial IS
  'Admin-managed portal banner without a company profile. Existing company campaigns remain false and profile-bound.';

-- Existing owner/admin read policies already exclude unbound rows from owners
-- and permit portal admins. Keep all table grants and RLS policies unchanged.
CREATE FUNCTION public.create_editorial_ad_campaign(
  p_target_type text, p_target_key text DEFAULT NULL, p_placement text DEFAULT 'top_banner')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE new_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF p_target_type IS NULL OR p_target_type NOT IN ('homepage','experts_directory','portal_area')
   OR (p_target_type IN ('homepage','experts_directory') AND p_target_key IS NOT NULL)
   OR (p_target_type='portal_area' AND (p_target_key IS NULL OR NOT EXISTS
     (SELECT 1 FROM public.ad_portal_areas WHERE target_key=p_target_key)))
 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 IF p_placement IS NULL OR p_placement NOT IN ('top_banner','sidebar_top','sidebar_middle','sidebar_bottom',
   'sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08',
   'sidebar_09','sidebar_10','sidebar_11','sidebar_12')
 THEN RAISE EXCEPTION 'invalid placement'; END IF;
 INSERT INTO public.company_ad_campaigns(profile_id,is_editorial,placement)
 VALUES(NULL,true,p_placement) RETURNING id INTO new_id;
 INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type,target_key,placement)
 VALUES(new_id,p_target_type,p_target_key,p_placement);
 RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_editorial_ad_campaign(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_editorial_ad_campaign(text,text,text) TO authenticated;

-- Only the authorization joins change; creative/target validation, publication
-- states, category assignment checks, advisory lock and conflict checks stay intact.
CREATE OR REPLACE FUNCTION public.save_ad_campaign(p_campaign_id uuid,p_data jsonb,p_submit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; media text; destination text; targets jsonb; is_admin boolean;
BEGIN
 is_admin := auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid());
 IF is_admin AND current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 IF is_admin THEN PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041); END IF;
 SELECT a.* INTO campaign FROM public.company_ad_campaigns a
 LEFT JOIN public.company_profiles p ON p.id=a.profile_id
 LEFT JOIN public.companies c ON c.id=p.company_id
 WHERE a.id=p_campaign_id AND (is_admin OR (NOT a.is_editorial AND c.owner_user_id=auth.uid())) FOR UPDATE OF a;
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

-- Existing Storage policies call this helper; no bucket/policy/grant changes.
CREATE OR REPLACE FUNCTION public.can_access_ad_media(p_path text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.company_ad_campaigns a
  LEFT JOIN public.company_profiles p ON p.id=a.profile_id
  LEFT JOIN public.companies c ON c.id=p.company_id
  WHERE p_path ~ ('^campaigns/'||a.id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$')
  AND CASE WHEN p_write THEN
    (NOT a.is_editorial AND c.owner_user_id=auth.uid() AND a.status IN ('draft','rejected'))
    OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
  ELSE (NOT a.is_editorial AND c.owner_user_id=auth.uid())
    OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
    OR (a.image_path=p_path AND a.status='approved'
      AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date)
  END);
$$;

-- An admin may exclude its unbound campaign; owners cannot hide foreign bookings.
CREATE OR REPLACE FUNCTION public.get_ad_slot_availability(p_start date,p_end date,p_exclude_campaign_id uuid DEFAULT NULL)
RETURNS TABLE(target_type text,category_id text,target_key text,placement text,status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_end<p_start THEN RAISE EXCEPTION 'invalid dates'; END IF;
 IF p_exclude_campaign_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.company_ad_campaigns a LEFT JOIN public.company_profiles p ON p.id=a.profile_id
   LEFT JOIN public.companies c ON c.id=p.company_id
   WHERE a.id=p_exclude_campaign_id AND ((NOT a.is_editorial AND c.owner_user_id=auth.uid())
     OR EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
 ) THEN p_exclude_campaign_id := NULL; END IF;
 RETURN QUERY SELECT DISTINCT t.target_type,t.category_id,t.target_key,coalesce(t.placement,a.placement),a.status
 FROM public.company_ad_campaigns a
 JOIN public.company_ad_campaign_targets t ON t.campaign_id=a.id
 WHERE a.id IS DISTINCT FROM p_exclude_campaign_id
 AND ((a.status='approved' AND a.approved_start_date<=p_end AND a.approved_end_date>=p_start)
   OR (a.status='pending' AND a.requested_start_date<=p_end AND a.requested_end_date>=p_start));
END; $$;

-- review_ad_campaign/get_active_ad_campaigns already work without profile joins
-- for portal targets; their grants, approval lifecycle and delivery are unchanged.
COMMIT;
