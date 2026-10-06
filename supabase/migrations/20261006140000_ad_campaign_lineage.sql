-- Stable logical banner identity. No historical rows merged or deleted.
BEGIN;
ALTER TABLE public.company_ad_campaigns ADD COLUMN lifecycle_group_id uuid;
CREATE INDEX company_ad_campaigns_lifecycle_group_idx
 ON public.company_ad_campaigns(lifecycle_group_id) WHERE lifecycle_group_id IS NOT NULL;
-- Existing table-wide authenticated SELECT and existing admin/owner RLS apply.
-- No INSERT/UPDATE grants, new public RPC, Storage policy or booking changes.
CREATE OR REPLACE FUNCTION private.guard_archived_ad_campaign() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 -- Lineage can be assigned once by privileged lifecycle/verified maintenance;
 -- clients have no direct UPDATE privilege. Existing lineage is immutable.
 IF OLD.lifecycle_group_id IS NOT NULL AND NEW.lifecycle_group_id IS DISTINCT FROM OLD.lifecycle_group_id THEN
   RAISE EXCEPTION 'Banner lineage is immutable';
 END IF;
 IF OLD.archived_at IS NOT NULL AND
 (to_jsonb(NEW)-'deletion_requested_at'-'updated_at'-'lifecycle_group_id') IS DISTINCT FROM
 (to_jsonb(OLD)-'deletion_requested_at'-'updated_at'-'lifecycle_group_id') THEN
   RAISE EXCEPTION 'Archived campaigns are immutable';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_archived_ad_campaign() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_ad_lifecycle(p_id uuid,p_action text,p_image_path text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE original public.company_ad_campaigns; new_id uuid; group_id uuid; BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'Admin required'; END IF;
 IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'read committed required'; END IF;
 PERFORM pg_advisory_xact_lock(20260917,203041);
 SELECT * INTO original FROM public.company_ad_campaigns WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found'; END IF;
 IF p_action='archive' THEN
  IF original.archived_at IS NULL THEN UPDATE public.company_ad_campaigns SET archived_at=clock_timestamp() WHERE id=p_id; END IF;
 ELSIF p_action='reuse' THEN
  IF original.archived_at IS NULL OR original.deletion_requested_at IS NOT NULL THEN RAISE EXCEPTION 'Archive required'; END IF;
  group_id := coalesce(original.lifecycle_group_id,original.id);
  IF EXISTS (SELECT 1 FROM public.company_ad_campaigns a
    WHERE coalesce(a.lifecycle_group_id,a.id)=group_id
      AND a.archived_at IS NULL) THEN RAISE EXCEPTION 'Banner already reused'; END IF;
  IF original.lifecycle_group_id IS NULL THEN
    UPDATE public.company_ad_campaigns SET lifecycle_group_id=group_id WHERE id=p_id;
  END IF;
  INSERT INTO public.company_ad_campaigns(profile_id,is_editorial,internal_name,headline,body_text,target_url,lifecycle_group_id)
  VALUES(original.profile_id,original.is_editorial,original.internal_name,original.headline,original.body_text,original.target_url,group_id) RETURNING id INTO new_id;
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

COMMIT;
