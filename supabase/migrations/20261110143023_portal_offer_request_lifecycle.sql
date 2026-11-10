-- Request lifecycle only; no existing request, policy, booking or media is changed.
BEGIN;
-- Preserve the original immutable submission shape, allowing lifecycle timestamps.
ALTER TABLE public.company_ad_campaigns DROP CONSTRAINT general_offer_request_shape;
ALTER TABLE public.company_ad_campaigns ADD CONSTRAINT general_offer_request_shape CHECK (
 request_status IS NULL OR (status='draft' AND profile_id IS NULL AND NOT is_editorial
 AND request_key IS NOT NULL AND request_consent_at IS NOT NULL
 AND contact_name IS NOT NULL AND length(btrim(contact_name))>0
 AND contact_email IS NOT NULL AND contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 AND (image_path IS NULL OR (request_details->>'upload_path' IS NOT NULL AND image_path=request_details->>'upload_path'))
 AND target_url='' AND approved_start_date IS NULL AND approved_end_date IS NULL
 AND (deletion_requested_at IS NULL OR archived_at IS NOT NULL)));
CREATE OR REPLACE FUNCTION private.guard_general_offer_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at)
 AND (OLD.request_status IS NOT NULL OR NEW.request_status IS NOT NULL) THEN
  IF OLD.request_status IS NULL OR NEW.request_status IS DISTINCT FROM OLD.request_status
  OR auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
  THEN RAISE EXCEPTION 'Admin request lifecycle required' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND (OLD.request_status IS NOT NULL OR NEW.request_status IS NOT NULL) THEN
  IF (to_jsonb(NEW)-'request_status'-'updated_at'-'image_path'-'archived_at'-'deletion_requested_at') IS DISTINCT FROM (to_jsonb(OLD)-'request_status'-'updated_at'-'image_path'-'archived_at'-'deletion_requested_at')
   OR (NEW.image_path IS DISTINCT FROM OLD.image_path AND (OLD.request_status='new' AND OLD.image_path IS NULL AND NEW.image_path=OLD.request_details->>'upload_path') IS NOT TRUE)
  THEN RAISE EXCEPTION 'offer request details are immutable'; END IF;
 END IF;
 RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION private.guard_archived_ad_campaign()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 -- Lineage can be assigned once by privileged lifecycle/verified maintenance;
 -- clients have no direct UPDATE privilege. Existing lineage is immutable.
 IF OLD.lifecycle_group_id IS NOT NULL AND NEW.lifecycle_group_id IS DISTINCT FROM OLD.lifecycle_group_id THEN
   RAISE EXCEPTION 'Banner lineage is immutable';
 END IF;
 -- Only an unchanged general request may be restored by an administrator.
 IF OLD.request_status IS NOT NULL AND OLD.archived_at IS NOT NULL AND NEW.archived_at IS NULL
 AND OLD.deletion_requested_at IS NULL AND NEW.deletion_requested_at IS NULL
 AND auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
 AND (to_jsonb(NEW)-'archived_at'-'updated_at')=(to_jsonb(OLD)-'archived_at'-'updated_at') THEN RETURN NEW; END IF;
 IF OLD.archived_at IS NOT NULL AND
 (to_jsonb(NEW)-'deletion_requested_at'-'updated_at'-'lifecycle_group_id') IS DISTINCT FROM
 (to_jsonb(OLD)-'deletion_requested_at'-'updated_at'-'lifecycle_group_id') THEN
   RAISE EXCEPTION 'Archived campaigns are immutable';
 END IF;
 RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.save_portal_offer_request_workspace(p_id uuid, p_status text, p_details jsonb, p_note text, p_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE w public.portal_offer_request_workspaces; next_revision integer; note text:=nullif(btrim(p_note),'');
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 IF p_revision IS NULL OR p_revision<0 OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR octet_length(p_details::text)>12000
 OR char_length(note)>4000 OR EXISTS(SELECT 1 FROM jsonb_each(p_details) e WHERE e.key NOT IN
 ('company_name','contact_name','contact_email','contact_phone','website','internal_name','requested_start_date','requested_end_date','placement_notes')
 OR jsonb_typeof(e.value)<>'string' OR char_length(e.value #>> '{}')>2000)
 THEN RAISE EXCEPTION 'invalid workspace'; END IF;
 -- Serialize the first workspace creation too, without modifying source data.
 PERFORM pg_catalog.pg_advisory_xact_lock(20261029,pg_catalog.hashtext(p_id::text));
 PERFORM 1 FROM public.company_ad_campaigns WHERE id=p_id AND request_status IS NOT NULL AND archived_at IS NULL AND deletion_requested_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'offer request not found'; END IF;
 SELECT * INTO w FROM public.portal_offer_request_workspaces WHERE request_id=p_id FOR UPDATE;
 IF coalesce(w.revision,0)<>p_revision THEN RAISE EXCEPTION 'request_changed'; END IF;
 next_revision:=coalesce(w.revision,0)+1;
 PERFORM public.set_portal_offer_request_status(p_id,p_status);
 INSERT INTO public.portal_offer_request_workspaces(request_id,details,notes,revision,updated_at)
 VALUES(p_id,p_details,coalesce(w.notes,'[]'::jsonb)||CASE WHEN note IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('text',note,'at',clock_timestamp(),'author',auth.uid())) END,next_revision,clock_timestamp())
 ON CONFLICT(request_id) DO UPDATE SET details=EXCLUDED.details,notes=EXCLUDED.notes,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at;
 RETURN next_revision;
END; $function$;

CREATE FUNCTION private.admin_offer_request_lifecycle(p_id uuid,p_action text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.company_ad_campaigns;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid())
 THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('archive','restore','prepare_delete','delete')
 THEN RAISE EXCEPTION 'Invalid request action'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20260917,203041);
 PERFORM pg_catalog.pg_advisory_xact_lock(20261029,pg_catalog.hashtext(p_id::text));
 SELECT * INTO original FROM public.company_ad_campaigns WHERE id=p_id AND request_status IS NOT NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Offer request not found'; END IF;
 IF p_action='archive' THEN
  IF original.archived_at IS NULL THEN UPDATE public.company_ad_campaigns SET archived_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=p_id; END IF;
 ELSIF p_action='restore' THEN
  IF original.deletion_requested_at IS NOT NULL THEN RAISE EXCEPTION 'Deletion already prepared'; END IF;
  IF original.archived_at IS NOT NULL THEN UPDATE public.company_ad_campaigns SET archived_at=NULL,updated_at=clock_timestamp() WHERE id=p_id; END IF;
 ELSIF p_action='prepare_delete' THEN
  IF original.archived_at IS NULL THEN RAISE EXCEPTION 'Archive required'; END IF;
  UPDATE public.company_ad_campaigns SET deletion_requested_at=coalesce(deletion_requested_at,clock_timestamp()) WHERE id=p_id;
 ELSE
  IF original.archived_at IS NULL OR original.deletion_requested_at IS NULL THEN RAISE EXCEPTION 'Confirmed archive deletion required'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name LIKE 'campaigns/'||p_id::text||'/creative/%')
  THEN RAISE EXCEPTION 'Clean up media first'; END IF;
  DELETE FROM public.portal_offer_request_workspaces WHERE request_id=p_id;
  DELETE FROM public.company_ad_campaigns WHERE id=p_id;
 END IF;
 RETURN p_id;
END; $$;
REVOKE ALL ON FUNCTION private.admin_offer_request_lifecycle(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.admin_offer_request_lifecycle(uuid,text) TO authenticated;
CREATE FUNCTION public.admin_offer_request_lifecycle(p_id uuid,p_action text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.admin_offer_request_lifecycle(p_id,p_action); END;
REVOKE ALL ON FUNCTION public.admin_offer_request_lifecycle(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_offer_request_lifecycle(uuid,text) TO authenticated;
COMMIT;
