-- Repository only. Keep the owner and public policies in place.
CREATE POLICY company_images_admin_insert ON public.company_profile_images
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY company_images_admin_update ON public.company_profile_images
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
);
CREATE POLICY company_images_admin_delete ON public.company_profile_images
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
);

-- Existing admin SELECT was bucket-wide. Restrict it to valid profile paths.
ALTER POLICY company_media_admin_read ON storage.objects USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/(logo|gallery)/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id::text = (storage.foldername(name))[2])
);
CREATE POLICY company_media_admin_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/(logo|gallery)/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id::text = (storage.foldername(name))[2])
);
CREATE POLICY company_media_admin_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/(logo|gallery)/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id::text = (storage.foldername(name))[2])
  AND NOT EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.logo_path = name)
  AND NOT EXISTS (SELECT 1 FROM public.company_profile_images i WHERE i.storage_path = name)
);
-- No Storage UPDATE: uploads are immutable and always use upsert: false.

-- Preserve the existing parent lock, gallery limit and immutable media identity.
-- The admin check is explicit even though the invoker must also pass RLS.
CREATE OR REPLACE FUNCTION private.company_gallery_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN target := OLD.profile_id; ELSE target := NEW.profile_id; END IF;
  PERFORM 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = target AND (c.owner_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid())) FOR UPDATE OF p;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.company_profiles WHERE id = target) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.profile_id <> OLD.profile_id OR NEW.storage_path <> OLD.storage_path) THEN
    RAISE EXCEPTION 'media identity is immutable';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.company_profile_images WHERE profile_id = target) >= 8 THEN
    RAISE EXCEPTION 'gallery limit reached';
  END IF;
  UPDATE public.company_profiles SET logo_path = logo_path WHERE id = target;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Keep the exact-permutation check and owner access; allow portal admins too.
CREATE OR REPLACE FUNCTION public.reorder_company_images(p_profile_id uuid, p_image_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = p_profile_id AND (c.owner_user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid())) FOR UPDATE OF p;
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
