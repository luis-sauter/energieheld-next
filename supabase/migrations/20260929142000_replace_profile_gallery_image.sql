-- Permit an authorized editor to replace the storage reference of one gallery
-- row after the new, private object has been uploaded and validated. The row ID,
-- profile ID and sort order stay intact. Existing owner/admin RLS still applies.
GRANT UPDATE (storage_path) ON public.company_profile_images TO authenticated;

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
  IF TG_OP = 'UPDATE' AND NEW.profile_id <> OLD.profile_id THEN
    RAISE EXCEPTION 'media profile is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.storage_path <> OLD.storage_path AND (
    NEW.storage_path !~ ('^profiles/' || NEW.profile_id::text || '/gallery/[0-9a-f-]{36}\.(jpg|png|webp)$')
    OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'company-media' AND o.name = NEW.storage_path)
  ) THEN
    RAISE EXCEPTION 'replacement media must be an uploaded object of this profile';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.company_profile_images WHERE profile_id = target) >= 8 THEN
    RAISE EXCEPTION 'gallery limit reached';
  END IF;
  UPDATE public.company_profiles SET logo_path = logo_path WHERE id = target;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
