-- Local follow-up only. Initial publication still requires admin-assigned categories.
-- Ownership stays in RLS; status transitions are separately guarded against
-- self-approval while allowing an already approved row to stay approved.
CREATE FUNCTION public.guard_company_profile_publication() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id AND c.owner_user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()) THEN
    IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN RAISE EXCEPTION 'approval timestamp is admin controlled'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND (
      OLD.status = 'approved' OR NEW.status NOT IN ('draft','pending')
    ) THEN RAISE EXCEPTION 'publication is admin controlled'; END IF;
    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN RAISE EXCEPTION 'ownership is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_company_profile_publication BEFORE UPDATE ON public.company_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_company_profile_publication();
ALTER POLICY company_profiles_owner_update ON public.company_profiles WITH CHECK (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_profiles.company_id AND c.owner_user_id = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.company_logo_changed() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- Logo is ordinary profile content. Keep status and approved_at unchanged.
  RETURN NEW;
END;
$$;

-- Retain ownership, immutable paths, parent lock and the eight-image limit.
CREATE OR REPLACE FUNCTION private.company_gallery_changed() RETURNS trigger
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
    logo_path = logo_path WHERE id = target;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Existing published profiles need category maintenance without a new review.
CREATE FUNCTION public.set_company_profile_categories(p_profile_id uuid, p_category_ids text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF coalesce(cardinality(p_category_ids),0) = 0 OR EXISTS (
    SELECT 1 FROM unnest(p_category_ids) AS t(id) WHERE id IS NULL OR NOT public.is_energyheld_category_id(id)
  ) THEN RAISE EXCEPTION 'valid categories required'; END IF;
  PERFORM 1 FROM public.company_profiles WHERE id = p_profile_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'published profile not found'; END IF;
  DELETE FROM public.company_profile_categories WHERE profile_id = p_profile_id;
  INSERT INTO public.company_profile_categories(profile_id,category_id)
    SELECT p_profile_id,id FROM (SELECT DISTINCT unnest(p_category_ids) AS id) categories;
END;
$$;
REVOKE ALL ON FUNCTION public.set_company_profile_categories(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_profile_categories(uuid,text[]) TO authenticated;
