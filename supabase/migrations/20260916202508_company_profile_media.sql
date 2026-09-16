-- Repository-only migration. Apply separately after review.
ALTER TABLE public.company_profiles ADD COLUMN logo_path text;
ALTER TABLE public.company_profiles ADD CONSTRAINT company_logo_path_format CHECK (
  logo_path IS NULL OR logo_path ~ ('^profiles/' || id::text || '/logo/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
GRANT SELECT (logo_path) ON public.company_profiles TO anon, authenticated;
GRANT UPDATE (logo_path) ON public.company_profiles TO authenticated;

CREATE TABLE public.company_profile_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  alt_text text CHECK (char_length(alt_text) <= 500),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (storage_path ~ ('^profiles/' || profile_id::text || '/gallery/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);
CREATE INDEX company_profile_images_order ON public.company_profile_images(profile_id, sort_order, id);
ALTER TABLE public.company_profile_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_images FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_profile_images TO anon, authenticated;
GRANT INSERT (profile_id, storage_path, alt_text, sort_order) ON public.company_profile_images TO authenticated;
GRANT UPDATE (alt_text, sort_order) ON public.company_profile_images TO authenticated;
GRANT DELETE ON public.company_profile_images TO authenticated;
CREATE POLICY company_images_public ON public.company_profile_images FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY company_images_owner ON public.company_profile_images FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid()))
);
CREATE POLICY company_images_admin_read ON public.company_profile_images FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
);

-- BEFORE triggers make moderation invalidation inseparable from direct API edits.
-- Logo changes need no extra column privileges for the trigger's NEW values.
CREATE FUNCTION public.company_logo_changed() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.logo_path IS DISTINCT FROM OLD.logo_path THEN
    IF OLD.status IN ('approved', 'rejected') THEN NEW.status := 'draft'; END IF;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER company_logo_changed BEFORE UPDATE OF logo_path ON public.company_profiles
FOR EACH ROW EXECUTE FUNCTION public.company_logo_changed();

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
-- Narrow trigger-only privilege: lock the parent and invalidate its approval.
-- It is not an exposed RPC and verifies actual ownership independently of RLS.
CREATE FUNCTION private.company_gallery_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target uuid; profile_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN target := OLD.profile_id; ELSE target := NEW.profile_id; END IF;
  SELECT p.status INTO profile_status FROM public.company_profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = target AND c.owner_user_id = auth.uid() FOR UPDATE OF p;
  IF NOT FOUND THEN
    -- Allow FK cleanup only after the parent itself has been removed.
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.company_profiles WHERE id = target) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.profile_id <> OLD.profile_id OR NEW.storage_path <> OLD.storage_path) THEN
    RAISE EXCEPTION 'media identity is immutable';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.company_profile_images WHERE profile_id = target) >= 8 THEN
    RAISE EXCEPTION 'gallery limit reached';
  END IF;
  UPDATE public.company_profiles SET
    status = CASE WHEN profile_status IN ('approved','rejected') THEN 'draft' ELSE profile_status END,
    approved_at = NULL WHERE id = target;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.company_gallery_changed() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER company_gallery_changed BEFORE INSERT OR UPDATE OR DELETE ON public.company_profile_images
FOR EACH ROW EXECUTE FUNCTION private.company_gallery_changed();

-- Atomic ordering; callers cannot reorder a foreign or incomplete gallery.
CREATE FUNCTION public.reorder_company_images(p_profile_id uuid, p_image_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = p_profile_id AND c.owner_user_id = auth.uid() FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_image_ids IS NULL OR cardinality(p_image_ids) <> (SELECT count(*) FROM public.company_profile_images WHERE profile_id = p_profile_id)
    OR cardinality(p_image_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_image_ids) AS t(id))
    OR EXISTS (SELECT 1 FROM unnest(p_image_ids) AS t(id) WHERE NOT EXISTS (
      SELECT 1 FROM public.company_profile_images i WHERE i.id = t.id AND i.profile_id = p_profile_id)) THEN
    RAISE EXCEPTION 'gallery changed; reload';
  END IF;
  UPDATE public.company_profile_images i SET sort_order = t.ordinality::integer - 1
    FROM unnest(p_image_ids) WITH ORDINALITY AS t(id, ordinality)
    WHERE i.id = t.id AND i.profile_id = p_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reorder_company_images(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_company_images(uuid, uuid[]) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-media', 'company-media', false, 5242880, ARRAY['image/jpeg','image/png','image/webp']);

CREATE POLICY company_media_owner_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'company-media' AND (storage.foldername(name))[1] = 'profiles' AND EXISTS (
    SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id::text = (storage.foldername(name))[2] AND c.owner_user_id = (SELECT auth.uid()))
);
CREATE POLICY company_media_owner_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'company-media' AND name ~ '^profiles/[0-9a-f-]{36}/(logo|gallery)/[0-9a-f-]{36}\.(jpg|png|webp)$' AND EXISTS (
    SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id::text = (storage.foldername(name))[2] AND c.owner_user_id = (SELECT auth.uid()))
);
-- Referenced objects must first be detached through metadata changes (which
-- invalidate approval). No UPDATE policy: files cannot be overwritten in place.
CREATE POLICY company_media_owner_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'company-media' AND (storage.foldername(name))[1] = 'profiles' AND EXISTS (
    SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id::text = (storage.foldername(name))[2] AND c.owner_user_id = (SELECT auth.uid()))
  AND NOT EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.logo_path = name)
  AND NOT EXISTS (SELECT 1 FROM public.company_profile_images i WHERE i.storage_path = name)
);
CREATE POLICY company_media_admin_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'company-media' AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY company_media_public_read ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id = 'company-media' AND (storage.foldername(name))[1] = 'profiles' AND EXISTS (
    SELECT 1 FROM public.company_profiles p WHERE p.id::text = (storage.foldername(name))[2] AND p.status = 'approved'
    AND (p.logo_path = name OR EXISTS (
      SELECT 1 FROM public.company_profile_images i WHERE i.profile_id = p.id AND i.storage_path = name))
  )
);
