-- Follow-up: original request form; requested placements are wishes, never bookings.
-- Existing rows and booking targets remain unchanged. Bucket stays private.
BEGIN;
ALTER TABLE public.company_ad_campaigns ADD COLUMN request_details jsonb CHECK (request_details IS NULL OR jsonb_typeof(request_details)='object');
ALTER TABLE public.company_ad_campaigns ALTER COLUMN requested_start_date DROP NOT NULL, ALTER COLUMN requested_end_date DROP NOT NULL;
ALTER TABLE public.company_ad_campaigns ADD CONSTRAINT booked_campaign_dates_present CHECK (request_status IS NOT NULL OR (requested_start_date IS NOT NULL AND requested_end_date IS NOT NULL));
ALTER TABLE public.company_ad_campaigns DROP CONSTRAINT general_offer_request_shape;
ALTER TABLE public.company_ad_campaigns ADD CONSTRAINT general_offer_request_shape CHECK (
 request_status IS NULL OR (status='draft' AND profile_id IS NULL AND NOT is_editorial
 AND request_key IS NOT NULL AND request_consent_at IS NOT NULL
 AND contact_name IS NOT NULL AND length(btrim(contact_name))>0
 AND contact_email IS NOT NULL AND contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 AND (image_path IS NULL OR (request_details->>'upload_path' IS NOT NULL AND image_path=request_details->>'upload_path')) AND target_url='' AND approved_start_date IS NULL AND approved_end_date IS NULL
 AND archived_at IS NULL AND deletion_requested_at IS NULL));

CREATE OR REPLACE FUNCTION private.guard_general_offer_request() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.request_status IS NOT NULL OR NEW.request_status IS NOT NULL) THEN
  IF (to_jsonb(NEW)-'request_status'-'updated_at'-'image_path') IS DISTINCT FROM (to_jsonb(OLD)-'request_status'-'updated_at'-'image_path')
   OR (NEW.image_path IS DISTINCT FROM OLD.image_path AND (OLD.request_status='new' AND OLD.image_path IS NULL AND NEW.image_path=OLD.request_details->>'upload_path') IS NOT TRUE)
  THEN RAISE EXCEPTION 'offer request details are immutable'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION private.submit_portal_offer_request(p_data jsonb,p_key uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE company text:=btrim(p_data->>'company_name'); person text:=btrim(p_data->>'contact_name'); email text:=lower(btrim(p_data->>'contact_email')); phone text:=btrim(p_data->>'contact_phone');
 website text:=nullif(btrim(p_data->>'website'),''); message text:=nullif(btrim(p_data->>'message'),''); details jsonb:=p_data->'details'; dest text; first_day text; last_day text;
 existing public.company_ad_campaigns; image_type text; image_size bigint; image_ext text; upload_path text;
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR p_key IS NULL
 OR jsonb_typeof(p_data->'company_name') IS DISTINCT FROM 'string' OR char_length(company)>120
 OR jsonb_typeof(p_data->'contact_name') IS DISTINCT FROM 'string' OR coalesce(char_length(person),0) NOT BETWEEN 1 AND 120
 OR jsonb_typeof(p_data->'contact_email') IS DISTINCT FROM 'string' OR coalesce(char_length(email),0) NOT BETWEEN 3 AND 254 OR email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR jsonb_typeof(p_data->'contact_phone') IS DISTINCT FROM 'string' OR coalesce(char_length(phone),0) NOT BETWEEN 1 AND 60
 OR (p_data ? 'website' AND jsonb_typeof(p_data->'website') IS DISTINCT FROM 'string') OR (p_data ? 'message' AND jsonb_typeof(p_data->'message') IS DISTINCT FROM 'string')
 OR char_length(website)>2048 OR char_length(message)>400 OR (website IS NOT NULL AND website !~* '^https?://[^[:space:]@]+$')
 OR p_data->'consent' IS DISTINCT FROM 'true'::jsonb OR coalesce(p_data->>'fax','')<>''
 THEN RAISE EXCEPTION 'invalid offer request' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(details) IS DISTINCT FROM 'object' OR jsonb_typeof(details->'targets') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid offer details'; END IF;
 dest:=details->>'target_url'; first_day:=details->>'requested_start_date'; last_day:=details->>'requested_end_date';
 IF jsonb_typeof(details->'internal_name') IS DISTINCT FROM 'string' OR coalesce(char_length(btrim(details->>'internal_name')),0) NOT BETWEEN 1 AND 120
 OR jsonb_typeof(details->'target_url') IS DISTINCT FROM 'string' OR dest !~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' OR char_length(dest)>2048
 OR jsonb_typeof(details->'requested_start_date') IS DISTINCT FROM 'string' OR jsonb_typeof(details->'requested_end_date') IS DISTINCT FROM 'string'
 OR (first_day<>'' AND (first_day !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(first_day::date,'YYYY-MM-DD')<>first_day))
 OR (last_day<>'' AND (last_day !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(last_day::date,'YYYY-MM-DD')<>last_day))
 OR (first_day<>'' AND last_day<>'' AND first_day>last_day) OR jsonb_array_length(details->'targets')>128
 THEN RAISE EXCEPTION 'invalid offer details'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(details->'targets') t WHERE jsonb_typeof(t)<>'object'
 OR t->>'target_type' IS NULL OR t->>'target_type' NOT IN ('homepage','experts_directory','portal_area')
 OR t->>'placement' IS NULL OR t->>'placement' NOT IN ('top_banner','sidebar_top','sidebar_middle','sidebar_bottom','sidebar_04','sidebar_05','sidebar_06','sidebar_07','sidebar_08','sidebar_09','sidebar_10','sidebar_11','sidebar_12')
 OR t->>'category_id' IS NOT NULL OR (t->>'target_type' IN ('homepage','experts_directory') AND t->>'target_key' IS NOT NULL)
 OR (t->>'target_type'='portal_area' AND NOT EXISTS(SELECT 1 FROM public.ad_portal_areas a WHERE a.target_key=t->>'target_key')))
 OR (SELECT count(*)<>count(DISTINCT (t->>'target_type',t->>'target_key',t->>'placement')) FROM jsonb_array_elements(details->'targets') t)
 THEN RAISE EXCEPTION 'invalid offer targets'; END IF;
 details:=details-'upload_path'-'image_type'-'image_size';
 IF p_data ? 'image_type' THEN
  image_type:=p_data->>'image_type';image_size:=(p_data->>'image_size')::bigint;
  image_ext:=CASE image_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
  IF image_ext IS NULL OR image_size IS NULL OR image_size NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'invalid offer image'; END IF;
  upload_path:='campaigns/'||p_key||'/creative/'||gen_random_uuid()||'.'||image_ext;
  details:=details||jsonb_build_object('upload_path',upload_path,'image_type',image_type,'image_size',image_size);
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261010,90721);
 SELECT * INTO existing FROM public.company_ad_campaigns WHERE request_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF existing.contact_name IS DISTINCT FROM person OR existing.contact_email IS DISTINCT FROM email OR existing.contact_phone IS DISTINCT FROM phone
   OR existing.request_company_name IS DISTINCT FROM nullif(company,'') OR existing.request_message IS DISTINCT FROM message
   OR (existing.request_details-'upload_path'-'image_type'-'image_size') IS DISTINCT FROM (details-'upload_path'-'image_type'-'image_size')
  THEN RAISE EXCEPTION 'request key already used with different details'; END IF;
  IF p_data->>'uploaded_path' IS NOT NULL THEN
   IF existing.request_status<>'new' OR existing.request_details->>'upload_path' IS DISTINCT FROM p_data->>'uploaded_path' OR existing.created_at<now()-interval '1 hour' THEN RAISE EXCEPTION 'invalid offer image'; END IF;
   IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='ad-media' AND o.name=p_data->>'uploaded_path'
    AND o.metadata->>'mimetype'=existing.request_details->>'image_type' AND (o.metadata->>'size')::bigint=(existing.request_details->>'image_size')::bigint) THEN RAISE EXCEPTION 'invalid offer image'; END IF;
   UPDATE public.company_ad_campaigns SET image_path=p_data->>'uploaded_path' WHERE id=existing.id AND image_path IS NULL;
  END IF;
  RETURN;
 END IF;
 IF p_data ? 'uploaded_path' THEN RAISE EXCEPTION 'offer image not prepared'; END IF;
 IF (SELECT count(*) FROM public.company_ad_campaigns WHERE request_status IS NOT NULL AND created_at>now()-interval '1 minute')>=20
 OR (SELECT count(*) FROM public.company_ad_campaigns WHERE request_status IS NOT NULL AND created_at>now()-interval '1 day')>=500
 OR (SELECT count(*) FROM public.company_ad_campaigns WHERE request_status IS NOT NULL AND contact_email=email AND created_at>now()-interval '1 hour')>=3
 THEN RAISE EXCEPTION 'offer request rate limit'; END IF;
 INSERT INTO public.company_ad_campaigns(id,requested_start_date,requested_end_date,is_editorial,profile_id,internal_name,contact_name,contact_email,contact_phone,request_status,request_company_name,request_website,request_message,request_key,request_consent_at,submitted_at,request_details)
 VALUES(p_key,NULL,NULL,false,NULL,details->>'internal_name',person,email,phone,'new',nullif(company,''),dest,message,p_key,clock_timestamp(),clock_timestamp(),details);
END; $$;
CREATE FUNCTION private.prepare_portal_offer_image(p_data jsonb,p_key uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE path text;
BEGIN
 PERFORM private.submit_portal_offer_request(p_data,p_key);
 SELECT request_details->>'upload_path' INTO path FROM public.company_ad_campaigns WHERE request_key=p_key AND request_status='new' AND image_path IS NULL AND created_at>now()-interval '1 hour';
 IF path IS NULL THEN RAISE EXCEPTION 'offer upload unavailable'; END IF;
 RETURN path;
END; $$;
REVOKE ALL ON FUNCTION private.prepare_portal_offer_image(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.prepare_portal_offer_image(jsonb,uuid) TO anon,authenticated;
CREATE FUNCTION public.prepare_portal_offer_image(p_data jsonb,p_key uuid) RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.prepare_portal_offer_image(p_data,p_key); END;
REVOKE ALL ON FUNCTION public.prepare_portal_offer_image(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_portal_offer_image(jsonb,uuid) TO anon,authenticated;
-- Capability is two unpredictable UUIDs in an exact path, expires in one hour.
-- No table reads, listing without capability, UPDATE/upsert or DELETE granted.
CREATE FUNCTION private.can_upload_offer_image(p_name text,p_mime text DEFAULT NULL,p_size bigint DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.company_ad_campaigns c WHERE c.request_status='new' AND c.request_details->>'upload_path'=p_name AND c.created_at>now()-interval '1 hour'
 AND (p_mime IS NULL OR (c.image_path IS NULL AND p_mime=c.request_details->>'image_type' AND p_size=(c.request_details->>'image_size')::bigint)))
$$;
REVOKE ALL ON FUNCTION private.can_upload_offer_image(text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.can_upload_offer_image(text,text,bigint) TO anon,authenticated;
CREATE FUNCTION public.can_upload_offer_image(p_name text,p_mime text DEFAULT NULL,p_size bigint DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.can_upload_offer_image(p_name,p_mime,p_size); END;
REVOKE ALL ON FUNCTION public.can_upload_offer_image(text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_offer_image(text,text,bigint) TO anon,authenticated;
CREATE POLICY offer_request_image_insert ON storage.objects FOR INSERT TO anon,authenticated
 WITH CHECK (bucket_id='ad-media' AND metadata->>'mimetype' IS NOT NULL AND metadata->>'size' IS NOT NULL AND public.can_upload_offer_image(name,metadata->>'mimetype',(metadata->>'size')::bigint));
CREATE POLICY offer_request_image_read ON storage.objects FOR SELECT TO anon,authenticated
 USING (bucket_id='ad-media' AND public.can_upload_offer_image(name));
COMMIT;
