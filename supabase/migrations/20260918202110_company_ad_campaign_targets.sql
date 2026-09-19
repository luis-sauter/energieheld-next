-- LOCAL REPOSITORY MIGRATION ONLY. Apply separately before deploying this frontend.
-- Preserve every campaign column, ID, status, creative and decision. Legacy scope
-- columns remain as a deprecated historical snapshot and are no longer read/written by RPCs.
-- Run the whole migration in one transaction. Block legacy campaign writes during backfill.
LOCK TABLE public.company_ad_campaigns IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE public.company_ad_campaign_targets (
 campaign_id uuid NOT NULL REFERENCES public.company_ad_campaigns(id) ON DELETE CASCADE,
 target_type text NOT NULL CHECK (target_type IN ('experts_directory','trade')),
 category_id text,
 CONSTRAINT ad_target_shape CHECK (
   (target_type='experts_directory' AND category_id IS NULL) OR
   (target_type='trade' AND category_id IS NOT NULL AND public.is_energyheld_category_id(category_id))),
 CONSTRAINT ad_target_unique UNIQUE NULLS NOT DISTINCT (campaign_id,target_type,category_id)
);
CREATE INDEX ad_target_lookup_idx ON public.company_ad_campaign_targets(target_type,category_id,campaign_id);
ALTER TABLE public.company_ad_campaign_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_ad_campaign_targets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_ad_campaign_targets TO authenticated;
-- Campaign RLS already restricts this subquery to owners and portal admins.
CREATE POLICY ad_targets_read ON public.company_ad_campaign_targets FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.company_ad_campaigns a WHERE a.id=campaign_id));
-- No client mutation grants or policies. Existing authorized RPCs own all mutations.
INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type,category_id)
 SELECT id,scope_type,category_id FROM public.company_ad_campaigns WHERE scope_type IN ('experts_directory','trade');
-- Preserve the complete old wildcard meaning as explicit historical targets.
-- Unassigned trades are retained for review, never publicly served. No statuses are changed.
INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type,category_id)
 SELECT a.id,'trade',c FROM public.company_ad_campaigns a CROSS JOIN unnest(ARRAY[
 'energieberatung','dach','daemmung','keller','fassade','fenster','elektro','heizung',
 'lueftung','klimatechnik','solar','solarthermie','aussenbereich','trockenbau','boden']) c WHERE a.scope_type='all_trades';
COMMENT ON COLUMN public.company_ad_campaigns.scope_type IS 'Deprecated historical scope; company_ad_campaign_targets is authoritative.';
COMMENT ON COLUMN public.company_ad_campaigns.category_id IS 'Deprecated historical category; company_ad_campaign_targets is authoritative.';

CREATE OR REPLACE FUNCTION public.create_ad_campaign() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE own_profile uuid; campaign_id uuid;
BEGIN
 SELECT p.id INTO own_profile FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE c.owner_user_id=auth.uid();
 IF own_profile IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
 INSERT INTO public.company_ad_campaigns(profile_id) VALUES(own_profile) RETURNING id INTO campaign_id;
 INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type) VALUES(campaign_id,'experts_directory');
 RETURN campaign_id;
END; $$;

CREATE OR REPLACE FUNCTION public.save_ad_campaign(p_campaign_id uuid,p_data jsonb,p_submit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; media text; destination text; targets jsonb;
BEGIN
 SELECT a.* INTO campaign FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id JOIN public.companies c ON c.id=p.company_id
 WHERE a.id=p_campaign_id AND c.owner_user_id=auth.uid() FOR UPDATE OF a;
 IF NOT FOUND OR campaign.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'not editable'; END IF;
 targets := p_data->'targets';
 IF targets IS NULL OR jsonb_typeof(targets)<>'array' THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 IF jsonb_array_length(targets)<1 OR jsonb_array_length(targets)>16 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(targets) t WHERE jsonb_typeof(t)<>'object'
   OR (t->>'target_type') IS NULL OR t->>'target_type' NOT IN ('experts_directory','trade')
   OR (t->>'target_type'='experts_directory' AND t->>'category_id' IS NOT NULL)
   OR (t->>'target_type'='trade' AND (t->>'category_id' IS NULL OR NOT public.is_energyheld_category_id(t->>'category_id'))))
 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 -- Hold selected official assignments until commit; concurrent removal waits.
 PERFORM 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id
   AND pc.category_id IN (SELECT t->>'category_id' FROM jsonb_array_elements(targets) t) FOR SHARE;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(targets) t WHERE t->>'target_type'='trade'
   AND NOT EXISTS (SELECT 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id AND pc.category_id=t->>'category_id'))
 THEN RAISE EXCEPTION 'ad_target_not_assigned'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(targets)) <> (SELECT count(DISTINCT (t->>'target_type',t->>'category_id')) FROM jsonb_array_elements(targets) t)
 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 DELETE FROM public.company_ad_campaign_targets WHERE campaign_id=campaign.id;
 INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type,category_id)
 SELECT campaign.id,t->>'target_type',t->>'category_id' FROM jsonb_array_elements(targets) t;
 media := nullif(p_data->>'image_path',''); destination := btrim(p_data->>'target_url');
 IF coalesce(length(btrim(p_data->>'internal_name')),0)=0 OR coalesce(length(btrim(p_data->>'headline')),0)=0
 OR destination IS NULL OR destination !~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' THEN RAISE EXCEPTION 'invalid creative'; END IF;
 IF media IS NOT NULL AND (media !~ ('^campaigns/'||campaign.id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$') OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name=media)) THEN RAISE EXCEPTION 'invalid media'; END IF;
 IF p_submit AND media IS NULL THEN RAISE EXCEPTION 'image required'; END IF;
 UPDATE public.company_ad_campaigns SET
 internal_name=btrim(p_data->>'internal_name'), placement=p_data->>'placement',
 requested_start_date=(p_data->>'requested_start_date')::date, requested_end_date=(p_data->>'requested_end_date')::date,
 headline=btrim(p_data->>'headline'), body_text=nullif(btrim(p_data->>'body_text'),''),target_url=destination,image_path=media,
 status=CASE WHEN p_submit THEN 'pending' ELSE 'draft' END,
 submitted_at=CASE WHEN p_submit THEN clock_timestamp() ELSE submitted_at END, updated_at=clock_timestamp()
 WHERE id=campaign.id;
END; $$;

CREATE OR REPLACE FUNCTION public.review_ad_campaign(p_campaign_id uuid,p_decision text,p_start date DEFAULT NULL,p_end date DEFAULT NULL,p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; start_day date; end_day date;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approve','reject','pause','resume') THEN RAISE EXCEPTION 'invalid decision'; END IF;
 -- A single transaction lock serializes all bookings across all targets.
 -- READ COMMITTED guarantees a fresh conflict snapshot after waiting on the lock.
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041);
 SELECT * INTO campaign FROM public.company_ad_campaigns WHERE id=p_campaign_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'campaign not found'; END IF;
 IF (p_decision IN ('approve','reject') AND campaign.status<>'pending') OR (p_decision='pause' AND campaign.status<>'approved') OR (p_decision='resume' AND campaign.status<>'paused') THEN RAISE EXCEPTION 'invalid transition'; END IF;
 IF char_length(p_note)>2000 THEN RAISE EXCEPTION 'invalid note'; END IF;
 IF p_decision IN ('approve','resume') THEN
   start_day:=CASE WHEN p_decision='resume' THEN campaign.approved_start_date ELSE p_start END;
   end_day:=CASE WHEN p_decision='resume' THEN campaign.approved_end_date ELSE p_end END;
   IF start_day IS NULL OR end_day IS NULL OR end_day<start_day THEN RAISE EXCEPTION 'invalid dates'; END IF;
   IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name=campaign.image_path) THEN RAISE EXCEPTION 'image required'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.company_ad_campaign_targets WHERE campaign_id=campaign.id) THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
   PERFORM 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id
     AND pc.category_id IN (SELECT category_id FROM public.company_ad_campaign_targets WHERE campaign_id=campaign.id AND target_type='trade') FOR SHARE;
   IF EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=campaign.id AND t.target_type='trade'
     AND NOT EXISTS (SELECT 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id AND pc.category_id=t.category_id))
   THEN RAISE EXCEPTION 'ad_target_not_assigned'; END IF;
   IF EXISTS (SELECT 1 FROM public.company_ad_campaigns a
     JOIN public.company_ad_campaign_targets booked ON booked.campaign_id=a.id
     JOIN public.company_ad_campaign_targets requested ON requested.campaign_id=campaign.id
       AND requested.target_type=booked.target_type AND requested.category_id IS NOT DISTINCT FROM booked.category_id
     WHERE a.id<>campaign.id AND a.status='approved' AND a.placement=campaign.placement
       AND a.approved_start_date<=end_day AND a.approved_end_date>=start_day) THEN
     RAISE EXCEPTION 'ad_booking_conflict';
   END IF;
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
 SELECT a.id,a.placement,a.headline,a.body_text,a.target_url,a.image_path FROM public.company_ad_campaigns a
 WHERE a.status='approved' AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date
 AND EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=a.id AND
   ((p_scope_type='experts_directory' AND p_category_id IS NULL AND t.target_type='experts_directory') OR
    (p_scope_type='trade' AND public.is_energyheld_category_id(p_category_id) AND t.target_type='trade' AND t.category_id=p_category_id
      AND EXISTS (SELECT 1 FROM public.company_profile_categories pc WHERE pc.profile_id=a.profile_id AND pc.category_id=t.category_id))))
 ORDER BY a.placement,a.id;
$$;
-- CREATE OR REPLACE preserves the existing restricted EXECUTE grants.
-- Storage, analytics, company/category/quality RLS and their mutation RPCs are unchanged.
