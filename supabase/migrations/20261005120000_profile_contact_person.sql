-- Optional contact person; no existing rows, bucket settings or policies rewritten.
BEGIN;
ALTER TABLE public.company_profiles
  ADD COLUMN contact_first_name text CHECK (char_length(contact_first_name) <= 120),
  ADD COLUMN contact_last_name text CHECK (char_length(contact_last_name) <= 120),
  ADD COLUMN contact_image_path text;
ALTER TABLE public.company_profiles ADD CONSTRAINT company_contact_image_path_format CHECK (
  contact_image_path IS NULL OR contact_image_path ~ ('^profiles/' || id::text || '/contact/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
);
GRANT SELECT (contact_first_name,contact_last_name,contact_image_path) ON public.company_profiles TO anon,authenticated;
GRANT UPDATE (contact_first_name,contact_last_name,contact_image_path) ON public.company_profiles TO authenticated;
-- Existing company_profiles RLS remains the owner/admin/public boundary.
CREATE FUNCTION public.can_access_profile_contact_image(p_name text,p_write boolean,p_remove boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE p record; allowed boolean:=false;
BEGIN
  IF p_name IS NULL OR p_name !~ '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/contact/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$' THEN RETURN false; END IF;
  SELECT id,status,contact_image_path INTO p FROM public.company_profiles WHERE id::text=split_part(p_name,'/',2);
  IF NOT FOUND THEN RETURN false; END IF;
  -- Anonymous reads need only publicly granted columns, not companies/admins.
  IF auth.uid() IS NOT NULL THEN
    allowed:=EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) OR
      EXISTS(SELECT 1 FROM public.companies c JOIN public.company_profiles cp ON cp.company_id=c.id
        WHERE cp.id=p.id AND c.owner_user_id=auth.uid());
  END IF;
  IF p_write THEN RETURN allowed AND (NOT p_remove OR NOT EXISTS(SELECT 1 FROM public.company_profiles WHERE contact_image_path=p_name)); END IF;
  RETURN allowed OR coalesce(p.status='approved' AND p.contact_image_path=p_name,false);
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_profile_contact_image(text,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_profile_contact_image(text,boolean,boolean) TO anon,authenticated;
CREATE POLICY company_contact_image_read ON storage.objects FOR SELECT TO anon,authenticated USING (
  bucket_id='company-media' AND public.can_access_profile_contact_image(name,false));
CREATE POLICY company_contact_image_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='company-media' AND public.can_access_profile_contact_image(name,true));
CREATE POLICY company_contact_image_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='company-media' AND public.can_access_profile_contact_image(name,true,true));
-- Permissive DELETE policies are ORed; this restrictive policy is ANDed with
-- their result and protects linked contact files without managed-schema triggers.
CREATE POLICY company_contact_image_delete_unreferenced ON storage.objects
AS RESTRICTIVE FOR DELETE TO authenticated USING (
  bucket_id <> 'company-media'
  OR name !~ '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/contact/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  OR NOT EXISTS (SELECT 1 FROM public.company_profiles WHERE contact_image_path=storage.objects.name)
);
CREATE FUNCTION private.guard_profile_contact_image() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN IF NEW.contact_image_path IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.contact_image_path IS NOT DISTINCT FROM OLD.contact_image_path THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NOT (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) OR
    EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND owner_user_id=auth.uid())) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NEW.contact_image_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects o
    WHERE o.bucket_id='company-media' AND o.name=NEW.contact_image_path
    AND o.metadata->>'mimetype'=CASE WHEN NEW.contact_image_path LIKE '%.jpg' THEN 'image/jpeg' WHEN NEW.contact_image_path LIKE '%.png' THEN 'image/png' ELSE 'image/webp' END
    AND CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,9}$' THEN (o.metadata->>'size')::bigint BETWEEN 1 AND 5242880 ELSE false END) THEN RAISE EXCEPTION 'invalid contact image'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_profile_contact_image() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_profile_contact_image BEFORE INSERT OR UPDATE OF contact_image_path ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION private.guard_profile_contact_image();
-- Extend the one canonical content projection, preserving its existing
-- no-op, child-row, revision and review-capability semantics and function ACL.
DO $$
DECLARE definition text:=pg_get_functiondef('private.track_profile_content()'::regprocedure);
BEGIN
  IF strpos(definition,'''logo_url'',''video_path'']')=0 THEN RAISE EXCEPTION 'unexpected freshness projection; inspect before applying'; END IF;
  EXECUTE replace(definition,'''logo_url'',''video_path'']','''logo_url'',''video_path'',''contact_first_name'',''contact_last_name'',''contact_image_path'']');
END;
$$;
COMMIT;
