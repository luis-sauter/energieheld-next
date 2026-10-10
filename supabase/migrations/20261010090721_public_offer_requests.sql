-- General offer requests use the existing advertising/admin request store.
-- No existing row, booking target, profile, media or policy is rewritten.
BEGIN;
ALTER TABLE public.company_ad_campaigns
 ADD COLUMN request_status text CHECK (request_status IN ('new','in_progress','done')),
 ADD COLUMN request_company_name text CHECK (char_length(request_company_name) BETWEEN 1 AND 120),
 ADD COLUMN request_website text CHECK (char_length(request_website)<=2048),
 ADD COLUMN request_message text CHECK (char_length(request_message)<=5000),
 ADD COLUMN request_key uuid UNIQUE,
 ADD COLUMN request_consent_at timestamptz;
ALTER TABLE public.company_ad_campaigns DROP CONSTRAINT ad_campaign_profile_binding;
ALTER TABLE public.company_ad_campaigns ADD CONSTRAINT ad_campaign_profile_binding CHECK (
 (request_status IS NULL AND is_editorial=(profile_id IS NULL)) OR
 (request_status IS NOT NULL AND NOT is_editorial AND profile_id IS NULL));
ALTER TABLE public.company_ad_campaigns ADD CONSTRAINT general_offer_request_shape CHECK (
 request_status IS NULL OR (status='draft' AND profile_id IS NULL AND NOT is_editorial
 AND request_company_name IS NOT NULL AND request_key IS NOT NULL AND request_consent_at IS NOT NULL
 AND contact_name IS NOT NULL AND length(btrim(contact_name))>0
 AND contact_email IS NOT NULL AND contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 AND image_path IS NULL AND target_url='' AND approved_start_date IS NULL AND approved_end_date IS NULL
 AND archived_at IS NULL AND deletion_requested_at IS NULL));
CREATE INDEX general_offer_request_queue ON public.company_ad_campaigns(request_status,created_at)
 WHERE request_status IS NOT NULL;

-- Existing RLS and table privileges remain intact. Guard every existing mutation
-- RPC too: general requests are not banner drafts and must never become bookings.
CREATE FUNCTION private.guard_general_offer_request() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.request_status IS NOT NULL OR NEW.request_status IS NOT NULL) THEN
  IF (to_jsonb(NEW)-'request_status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'request_status'-'updated_at')
  THEN RAISE EXCEPTION 'offer request details are immutable'; END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_general_offer_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_general_offer_request BEFORE UPDATE ON public.company_ad_campaigns
 FOR EACH ROW EXECUTE FUNCTION private.guard_general_offer_request();
CREATE FUNCTION private.guard_offer_request_target() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.company_ad_campaigns WHERE id=NEW.campaign_id AND request_status IS NOT NULL)
 THEN RAISE EXCEPTION 'offer requests cannot have booking targets'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_offer_request_target() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_offer_request_target BEFORE INSERT OR UPDATE ON public.company_ad_campaign_targets
 FOR EACH ROW EXECUTE FUNCTION private.guard_offer_request_target();

-- Narrow anonymous command, not table INSERT access. No request content/ID is returned.
-- Fixed search_path, bounded inputs, consent, honeypot, atomic deduplication and
-- global + per-email rate limits. No caller-supplied status, profile or targeting.
CREATE FUNCTION private.submit_portal_offer_request(p_data jsonb,p_key uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE company text:=btrim(p_data->>'company_name'); person text:=btrim(p_data->>'contact_name');
 email text:=lower(btrim(p_data->>'contact_email')); phone text:=nullif(btrim(p_data->>'contact_phone'),'');
 website text:=nullif(btrim(p_data->>'website'),''); message text:=nullif(btrim(p_data->>'message'),'');
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL OR
 jsonb_typeof(p_data->'company_name') IS DISTINCT FROM 'string' OR jsonb_typeof(p_data->'contact_name') IS DISTINCT FROM 'string' OR
 jsonb_typeof(p_data->'contact_email') IS DISTINCT FROM 'string' OR jsonb_typeof(p_data->'consent') IS DISTINCT FROM 'boolean' OR
 (p_data ? 'contact_phone' AND jsonb_typeof(p_data->'contact_phone') IS DISTINCT FROM 'string') OR
 (p_data ? 'website' AND jsonb_typeof(p_data->'website') IS DISTINCT FROM 'string') OR
 (p_data ? 'message' AND jsonb_typeof(p_data->'message') IS DISTINCT FROM 'string') OR
 (p_data ? 'fax' AND jsonb_typeof(p_data->'fax') IS DISTINCT FROM 'string') OR
 coalesce(char_length(company),0) NOT BETWEEN 1 AND 120 OR coalesce(char_length(person),0) NOT BETWEEN 1 AND 120 OR
 coalesce(char_length(email),0) NOT BETWEEN 3 AND 254 OR email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR
 char_length(phone)>60 OR char_length(website)>2048 OR char_length(message)>5000 OR
 (website IS NOT NULL AND website !~* '^https?://[^[:space:]@]+$') OR
 p_data->>'consent' IS DISTINCT FROM 'true' OR coalesce(p_data->>'fax','')<>''
 THEN RAISE EXCEPTION 'invalid offer request' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261010,90721);
 IF EXISTS(SELECT 1 FROM public.company_ad_campaigns WHERE request_key=p_key) THEN RETURN; END IF;
 IF (SELECT count(*) FROM public.company_ad_campaigns WHERE request_status IS NOT NULL AND created_at>now()-interval '1 minute')>=20 OR
 (SELECT count(*) FROM public.company_ad_campaigns WHERE request_status IS NOT NULL AND created_at>now()-interval '1 day')>=500 OR
 (SELECT count(*) FROM public.company_ad_campaigns WHERE request_status IS NOT NULL AND contact_email=email AND created_at>now()-interval '1 hour')>=3
 THEN RAISE EXCEPTION 'offer request rate limit' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.company_ad_campaigns(is_editorial,profile_id,internal_name,contact_name,contact_email,contact_phone,
 request_status,request_company_name,request_website,request_message,request_key,request_consent_at,submitted_at)
 VALUES(false,NULL,company,person,email,phone,'new',company,website,message,p_key,clock_timestamp(),clock_timestamp());
END; $$;
REVOKE ALL ON FUNCTION private.submit_portal_offer_request(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.submit_portal_offer_request(jsonb,uuid) TO anon,authenticated;
CREATE FUNCTION public.submit_portal_offer_request(p_data jsonb,p_key uuid) RETURNS void
 LANGUAGE sql SECURITY INVOKER SET search_path=''
 BEGIN ATOMIC SELECT private.submit_portal_offer_request(p_data,p_key); END;
REVOKE ALL ON FUNCTION public.submit_portal_offer_request(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_portal_offer_request(jsonb,uuid) TO anon,authenticated;

CREATE FUNCTION private.set_portal_offer_request_status(p_id uuid,p_status text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('new','in_progress','done') THEN RAISE EXCEPTION 'invalid request status'; END IF;
 UPDATE public.company_ad_campaigns SET request_status=p_status,updated_at=clock_timestamp()
 WHERE id=p_id AND request_status IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'offer request not found'; END IF;
END; $$;
REVOKE ALL ON FUNCTION private.set_portal_offer_request_status(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_portal_offer_request_status(uuid,text) TO authenticated;
CREATE FUNCTION public.set_portal_offer_request_status(p_id uuid,p_status text) RETURNS void
 LANGUAGE sql SECURITY INVOKER SET search_path=''
 BEGIN ATOMIC SELECT private.set_portal_offer_request_status(p_id,p_status); END;
REVOKE ALL ON FUNCTION public.set_portal_offer_request_status(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_portal_offer_request_status(uuid,text) TO authenticated;

-- Reuse the same editorial queue, including existing pending campaigns.
CREATE OR REPLACE FUNCTION public.editorial_work_queue(p_page integer DEFAULT 1,p_limit integer DEFAULT 8,p_kind text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  IF p_page IS NULL OR p_limit IS NULL OR p_page NOT BETWEEN 1 AND 100000 OR p_limit NOT BETWEEN 1 AND 20 OR (p_kind IS NOT NULL AND p_kind NOT IN ('profile','advertising','verification')) THEN RAISE EXCEPTION 'invalid page'; END IF;
  WITH tasks AS (
    SELECT p.id,'profile'::text AS kind,p.display_name AS name,p.submitted_at AS submitted_at,'pending'::text AS status,'/admin/firmen/'||p.id AS href FROM public.company_profiles p WHERE p.status='pending'
    UNION ALL SELECT c.id,'advertising',c.internal_name,c.submitted_at,coalesce(c.request_status,c.status),'/admin/werbung/'||c.id FROM public.company_ad_campaigns c WHERE c.archived_at IS NULL AND NOT c.is_editorial AND (c.status='pending' OR c.request_status IN ('new','in_progress'))
    UNION ALL SELECT q.profile_id,'verification',p.display_name,q.requested_at,q.status,'/admin/firmen/'||q.profile_id||'#verifizierung' FROM public.company_quality_requests q JOIN public.company_profiles p ON p.id=q.profile_id WHERE q.status='pending'
  ), counts AS (SELECT count(*) FILTER (WHERE kind='profile') AS profiles,count(*) FILTER (WHERE kind='advertising') AS advertising,count(*) FILTER (WHERE kind='verification') AS verifications,count(*) AS total FROM tasks)
  SELECT jsonb_build_object('counts',to_jsonb(counts),'tasks',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY submitted_at NULLS LAST,id,kind) FROM (SELECT * FROM tasks WHERE p_kind IS NULL OR kind=p_kind ORDER BY submitted_at NULLS LAST,id,kind LIMIT p_limit OFFSET (p_page-1)*p_limit)t),'[]'::jsonb)) INTO result FROM counts;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.editorial_work_queue(integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.editorial_work_queue(integer,integer,text) TO authenticated;


COMMIT;
