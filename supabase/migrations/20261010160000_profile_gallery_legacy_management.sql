-- Local preparation only: explicit legacy gallery adoption, no media/data backfill.
ALTER TABLE public.company_profiles ADD COLUMN gallery_initialized boolean NOT NULL DEFAULT false;
GRANT SELECT (gallery_initialized) ON public.company_profiles TO anon, authenticated;

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
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.company_profile_images WHERE profile_id = target) >= 40 THEN
    RAISE EXCEPTION 'gallery limit reached';
  END IF;
  UPDATE public.company_profiles SET logo_path = logo_path, gallery_initialized = true WHERE id = target;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- One explicit, atomic adoption. Owner/anon cannot call the admin workflow.
CREATE FUNCTION public.initialize_profile_gallery(p_profile uuid, p_paths text[], p_alts text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'admin required';
  END IF;
  PERFORM 1 FROM public.company_profiles WHERE id = p_profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_profiles WHERE id = p_profile AND gallery_initialized)
    OR EXISTS (SELECT 1 FROM public.company_profile_images WHERE profile_id = p_profile) THEN
    RAISE EXCEPTION 'gallery already changed';
  END IF;
  IF coalesce(cardinality(p_paths),0) < 1 OR cardinality(p_paths) > 40
    OR cardinality(p_alts) IS DISTINCT FROM cardinality(p_paths)
    OR array_ndims(p_paths) <> 1 OR array_ndims(p_alts) <> 1
    OR EXISTS (SELECT 1 FROM unnest(p_paths) path WHERE path IS NULL
      OR path !~ ('^profiles/' || p_profile::text || '/gallery/[0-9a-f-]{36}\.(jpg|png|webp)$')
      OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'company-media' AND o.name = path)) THEN
    RAISE EXCEPTION 'invalid gallery images';
  END IF;
  INSERT INTO public.company_profile_images(profile_id,storage_path,alt_text,sort_order)
    SELECT p_profile, p_paths[n], p_alts[n], n-array_lower(p_paths,1)
    FROM generate_subscripts(p_paths,1) n;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_profile_gallery(uuid,text[],text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_profile_gallery(uuid,text[],text[]) TO authenticated;
