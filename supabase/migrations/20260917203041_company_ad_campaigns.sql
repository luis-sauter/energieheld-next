-- Repository only. Advertising does not change profile publication, categories or quality reviews.
CREATE TABLE public.company_ad_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
 internal_name text NOT NULL DEFAULT '' CHECK (char_length(internal_name)<=120),
 placement text NOT NULL DEFAULT 'top_banner' CHECK (placement IN ('top_banner','sidebar_top','sidebar_middle','sidebar_bottom')),
 scope_type text NOT NULL DEFAULT 'experts_directory' CHECK (scope_type IN ('experts_directory','all_trades','trade')),
 category_id text,
 requested_start_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::date,
 requested_end_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Berlin')::date,
 approved_start_date date,
 approved_end_date date,
 headline text NOT NULL DEFAULT '' CHECK (char_length(headline)<=100),
 body_text text CHECK (char_length(body_text)<=400),
 target_url text NOT NULL DEFAULT '' CHECK (char_length(target_url)<=2048),
 image_path text,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','paused')),
 admin_note text CHECK (char_length(admin_note)<=2000),
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((scope_type='trade' AND category_id IS NOT NULL AND public.is_energyheld_category_id(category_id)) OR (scope_type<>'trade' AND category_id IS NULL)),
 CHECK (requested_end_date>=requested_start_date),
 CHECK ((approved_start_date IS NULL AND approved_end_date IS NULL) OR (approved_start_date IS NOT NULL AND approved_end_date IS NOT NULL AND approved_end_date>=approved_start_date)),
 CHECK (status NOT IN ('approved','paused') OR approved_start_date IS NOT NULL),
 CHECK (status='draft' OR (length(btrim(internal_name))>0 AND length(btrim(headline))>0 AND image_path IS NOT NULL AND target_url ~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$')),
 CHECK (image_path IS NULL OR image_path ~ ('^campaigns/'||id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);
CREATE INDEX ad_campaigns_profile_idx ON public.company_ad_campaigns(profile_id);
CREATE INDEX ad_campaigns_active_idx ON public.company_ad_campaigns(placement,approved_start_date,approved_end_date) WHERE status='approved';
CREATE INDEX ad_campaigns_queue_idx ON public.company_ad_campaigns(status,submitted_at);
CREATE INDEX ad_campaigns_reviewer_idx ON public.company_ad_campaigns(reviewed_by);
ALTER TABLE public.company_ad_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_ad_campaigns FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_ad_campaigns TO authenticated;
CREATE POLICY ad_owner_read ON public.company_ad_campaigns FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid()))
);
CREATE POLICY ad_admin_read ON public.company_ad_campaigns FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid()))
);
-- All campaign mutations are explicit RPCs. Client fields cannot control review state.
CREATE FUNCTION public.create_ad_campaign() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE own_profile uuid; campaign_id uuid;
BEGIN
 SELECT p.id INTO own_profile FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE c.owner_user_id=auth.uid();
 IF own_profile IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
 INSERT INTO public.company_ad_campaigns(profile_id) VALUES(own_profile) RETURNING id INTO campaign_id;
 RETURN campaign_id;
END; $$;
CREATE FUNCTION public.save_ad_campaign(p_campaign_id uuid,p_data jsonb,p_submit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; media text; destination text;
BEGIN
 SELECT a.* INTO campaign FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id JOIN public.companies c ON c.id=p.company_id
 WHERE a.id=p_campaign_id AND c.owner_user_id=auth.uid() FOR UPDATE OF a;
 IF NOT FOUND OR campaign.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'not editable'; END IF;
 media := nullif(p_data->>'image_path',''); destination := btrim(p_data->>'target_url');
 IF coalesce(length(btrim(p_data->>'internal_name')),0)=0 OR coalesce(length(btrim(p_data->>'headline')),0)=0
 OR destination IS NULL OR destination !~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' THEN RAISE EXCEPTION 'invalid creative'; END IF;
 IF media IS NOT NULL AND (media !~ ('^campaigns/'||campaign.id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$') OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name=media)) THEN RAISE EXCEPTION 'invalid media'; END IF;
 IF p_submit AND media IS NULL THEN RAISE EXCEPTION 'image required'; END IF;
 UPDATE public.company_ad_campaigns SET
 internal_name=btrim(p_data->>'internal_name'), placement=p_data->>'placement', scope_type=p_data->>'scope_type', category_id=nullif(p_data->>'category_id',''),
 requested_start_date=(p_data->>'requested_start_date')::date, requested_end_date=(p_data->>'requested_end_date')::date,
 headline=btrim(p_data->>'headline'), body_text=nullif(btrim(p_data->>'body_text'),''),target_url=destination,image_path=media,
 status=CASE WHEN p_submit THEN 'pending' ELSE 'draft' END,
 submitted_at=CASE WHEN p_submit THEN clock_timestamp() ELSE submitted_at END, updated_at=clock_timestamp()
 WHERE id=campaign.id;
END; $$;
CREATE FUNCTION public.review_ad_campaign(p_campaign_id uuid,p_decision text,p_start date DEFAULT NULL,p_end date DEFAULT NULL,p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; start_day date; end_day date;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('approve','reject','pause','resume') THEN RAISE EXCEPTION 'invalid decision'; END IF;
 -- A single transaction lock serializes all bookings across wildcard scopes.
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
   IF EXISTS (SELECT 1 FROM public.company_ad_campaigns a WHERE a.id<>campaign.id AND a.status='approved' AND a.placement=campaign.placement
     AND a.approved_start_date<=end_day AND a.approved_end_date>=start_day
     AND ((a.scope_type='experts_directory' AND campaign.scope_type='experts_directory')
       OR (a.scope_type<>'experts_directory' AND campaign.scope_type<>'experts_directory'
         AND (a.scope_type='all_trades' OR campaign.scope_type='all_trades' OR a.category_id=campaign.category_id)))) THEN
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
-- Only this allowlisted projection is public. No campaign table access for anon.
CREATE FUNCTION public.get_active_ad_campaigns(p_scope_type text,p_category_id text DEFAULT NULL)
RETURNS TABLE(id uuid,placement text,headline text,body_text text,target_url text,image_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.id,a.placement,a.headline,a.body_text,a.target_url,a.image_path FROM public.company_ad_campaigns a
 WHERE a.status='approved' AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date
 AND ((p_scope_type='experts_directory' AND p_category_id IS NULL AND a.scope_type='experts_directory')
 OR (p_scope_type='trade' AND public.is_energyheld_category_id(p_category_id) AND (a.scope_type='all_trades' OR (a.scope_type='trade' AND a.category_id=p_category_id))))
 ORDER BY a.placement,a.id;
$$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('ad-media','ad-media',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);
CREATE FUNCTION public.can_access_ad_media(p_path text,p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id JOIN public.companies c ON c.id=p.company_id
 WHERE p_path ~ ('^campaigns/'||a.id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$') AND
 CASE WHEN p_write THEN c.owner_user_id=auth.uid() AND a.status IN ('draft','rejected')
 ELSE c.owner_user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
 OR (a.image_path=p_path AND a.status='approved' AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date) END);
$$;
CREATE FUNCTION public.ad_media_is_unreferenced(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS (SELECT 1 FROM public.company_ad_campaigns WHERE image_path=p_path);
$$;
CREATE POLICY ad_media_read ON storage.objects FOR SELECT TO anon,authenticated USING (bucket_id='ad-media' AND public.can_access_ad_media(name,false));
CREATE POLICY ad_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='ad-media' AND public.can_access_ad_media(name,true));
-- No UPDATE policy: creatives use immutable random paths, never overwrites.
CREATE POLICY ad_media_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='ad-media' AND public.can_access_ad_media(name,true) AND public.ad_media_is_unreferenced(name));
REVOKE ALL ON FUNCTION public.create_ad_campaign(),public.save_ad_campaign(uuid,jsonb,boolean),public.review_ad_campaign(uuid,text,date,date,text),public.get_active_ad_campaigns(text,text),public.can_access_ad_media(text,boolean),public.ad_media_is_unreferenced(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_ad_campaign(),public.save_ad_campaign(uuid,jsonb,boolean),public.review_ad_campaign(uuid,text,date,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_ad_campaigns(text,text),public.can_access_ad_media(text,boolean) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ad_media_is_unreferenced(text) TO authenticated;
