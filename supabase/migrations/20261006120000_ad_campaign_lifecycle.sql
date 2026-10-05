-- Additive admin lifecycle; no historical data or booking/presentation mappings rewritten.
BEGIN;
ALTER TABLE public.company_ad_campaigns ADD COLUMN archived_at timestamptz,
 ADD COLUMN deletion_requested_at timestamptz;
CREATE FUNCTION private.guard_archived_ad_campaign() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.archived_at IS NOT NULL AND
 (to_jsonb(NEW)-'deletion_requested_at'-'updated_at') IS DISTINCT FROM
 (to_jsonb(OLD)-'deletion_requested_at'-'updated_at') THEN
 RAISE EXCEPTION 'Archived campaigns are immutable'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_archived_ad_campaign() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_archived_ad_campaign BEFORE UPDATE ON public.company_ad_campaigns
FOR EACH ROW EXECUTE FUNCTION private.guard_archived_ad_campaign();
CREATE FUNCTION public.admin_ad_lifecycle(p_id uuid,p_action text,p_image_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.company_ad_campaigns; new_id uuid; BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 PERFORM pg_advisory_xact_lock(20260917,203041);
 SELECT * INTO original FROM public.company_ad_campaigns WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 IF p_action='archive' THEN
  IF original.archived_at IS NULL THEN UPDATE public.company_ad_campaigns SET archived_at=clock_timestamp() WHERE id=p_id; END IF;
 ELSIF p_action='reuse' THEN
  IF original.archived_at IS NULL OR original.deletion_requested_at IS NOT NULL THEN RAISE EXCEPTION 'Archive required'; END IF;
  INSERT INTO public.company_ad_campaigns(profile_id,is_editorial,internal_name,headline,body_text,target_url)
  VALUES(original.profile_id,original.is_editorial,original.internal_name,original.headline,original.body_text,original.target_url) RETURNING id INTO new_id;
  INSERT INTO public.ad_banner_search_metadata(banner_key,campaign_id,postal_code,city)
  SELECT 'campaign:'||new_id::text,new_id,postal_code,city FROM public.ad_banner_search_metadata WHERE campaign_id=p_id;
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
-- Only confirmed admin deletion permits removing an archived creative via existing Storage RLS.
CREATE OR REPLACE FUNCTION public.ad_media_is_unreferenced(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.company_ad_campaigns WHERE image_path=p_path
 AND NOT (archived_at IS NOT NULL AND deletion_requested_at IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())));
$$;

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
   WHERE a.id<>campaign.id AND a.archived_at IS NULL AND a.status='approved'
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
     WHERE a.id<>campaign.id AND a.archived_at IS NULL AND a.status='approved'
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
 WHERE a.archived_at IS NULL AND a.status='approved'
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
 AND ((a.archived_at IS NULL AND a.status='approved' AND a.approved_start_date<=p_end AND a.approved_end_date>=p_start)
   OR (a.status='pending' AND a.requested_start_date<=p_end AND a.requested_end_date>=p_start));
END; $$;

CREATE OR REPLACE FUNCTION public.can_access_ad_media(p_path text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.company_ad_campaigns a
  LEFT JOIN public.company_profiles p ON p.id=a.profile_id
  LEFT JOIN public.companies c ON c.id=p.company_id
  WHERE p_path ~ ('^campaigns/'||a.id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$')
  AND CASE WHEN p_write THEN
    (a.archived_at IS NULL AND NOT a.is_editorial AND c.owner_user_id=auth.uid() AND a.status IN ('draft','rejected'))
    OR ((a.archived_at IS NULL OR (a.deletion_requested_at IS NOT NULL AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ad-media' AND o.name=p_path))) AND auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
  ELSE (NOT a.is_editorial AND c.owner_user_id=auth.uid())
    OR (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()))
    OR (a.image_path=p_path AND a.archived_at IS NULL AND a.status='approved'
      AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date)
  END);
$$;
COMMIT;
