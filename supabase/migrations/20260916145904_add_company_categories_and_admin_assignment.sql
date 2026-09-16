-- LOCAL ONLY: apply separately after review. Requires the existing portal schema
-- and review_company_profile(uuid, text). No historical migration is recreated.
-- Do not guess categories or silently revoke existing approvals. Resolve these
-- records in a separately reviewed step before applying this migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.company_profiles WHERE status = 'approved') THEN
    RAISE EXCEPTION 'Existing approved profiles need a controlled category backfill or re-review before this migration. No approvals were changed.';
  END IF;
END $$;

ALTER TABLE public.company_profiles ADD COLUMN business_areas text;
GRANT UPDATE (business_areas) ON public.company_profiles TO authenticated;

-- Versioned snapshot of energieheld.categories. Tests compare this allowlist
-- with the canonical TypeScript configuration. Future changes need a migration.
CREATE FUNCTION public.is_energyheld_category_id(p_category_id text)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT p_category_id = ANY (ARRAY[
    'energieberatung', 'dach', 'daemmung', 'keller', 'fassade', 'fenster',
    'elektro', 'heizung', 'lueftung', 'klimatechnik', 'solar', 'solarthermie',
    'aussenbereich', 'trockenbau', 'boden'
  ]::text[]);
$$;

CREATE TABLE public.company_profile_categories (
  profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  category_id text NOT NULL CHECK (public.is_energyheld_category_id(category_id)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, category_id)
);
ALTER TABLE public.company_profile_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_categories FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_profile_categories TO anon, authenticated;

-- Minimal column privileges needed by the invoker's RLS subqueries. Existing
-- profile/company/admin RLS still restricts the rows; no write rights are added.
GRANT SELECT (id, status) ON public.company_profiles TO anon;
GRANT SELECT (id, owner_user_id) ON public.companies TO anon;
GRANT SELECT (user_id) ON public.portal_admins TO anon;

CREATE POLICY company_categories_public_approved ON public.company_profile_categories
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY company_categories_owner_read ON public.company_profile_categories
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = profile_id AND c.owner_user_id = (SELECT auth.uid()))
);
CREATE POLICY company_categories_admin_read ON public.company_profile_categories
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
-- Deliberately no INSERT/UPDATE/DELETE policies or grants for API roles.

CREATE FUNCTION public.review_company_profile_with_categories(
  p_profile_id uuid, p_decision text, p_category_ids text[]
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;
  IF p_decision = 'approved' AND coalesce(cardinality(p_category_ids), 0) = 0 THEN
    RAISE EXCEPTION 'at least one category required';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_category_ids) AS category(id)
    WHERE id IS NULL OR NOT public.is_energyheld_category_id(id)) THEN
    RAISE EXCEPTION 'invalid category';
  END IF;
  -- Serialize review calls and ordinary edits before replacing assignments.
  PERFORM 1 FROM public.company_profiles WHERE id = p_profile_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not pending or not found'; END IF;
  IF p_decision = 'approved' THEN
    DELETE FROM public.company_profile_categories WHERE profile_id = p_profile_id;
    INSERT INTO public.company_profile_categories (profile_id, category_id)
      SELECT p_profile_id, id FROM (SELECT DISTINCT unnest(p_category_ids) AS id) categories;
  END IF;
  UPDATE public.company_profiles SET status = p_decision,
    approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END
    WHERE id = p_profile_id;
  RETURN p_decision;
END;
$$;
REVOKE ALL ON FUNCTION public.review_company_profile_with_categories(uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_company_profile_with_categories(uuid, text, text[]) TO authenticated;

-- Minimal hardening of the existing RPC: approval requires an assignment.
CREATE OR REPLACE FUNCTION public.review_company_profile(p_profile_id uuid, p_decision text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;
  PERFORM 1 FROM public.company_profiles WHERE id = p_profile_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not pending or not found'; END IF;
  IF p_decision = 'approved' AND NOT EXISTS (
    SELECT 1 FROM public.company_profile_categories WHERE profile_id = p_profile_id
  ) THEN RAISE EXCEPTION 'at least one category required'; END IF;
  UPDATE public.company_profiles SET status = p_decision,
    approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END
    WHERE id = p_profile_id AND status = 'pending' RETURNING status INTO v_status;
  IF v_status IS NULL THEN RAISE EXCEPTION 'profile not pending or not found'; END IF;
  RETURN v_status;
END;
$$;

-- Deferred integrity checks also protect against direct updates by privileged
-- roles. Replacing assignments is allowed inside a transaction, never partially.
CREATE FUNCTION public.check_company_category_integrity() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE checked_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'company_profiles' THEN
    IF NEW.status <> 'approved' THEN RETURN NULL; END IF;
    checked_id := NEW.id;
  ELSE checked_id := OLD.profile_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = checked_id AND p.status = 'approved')
    AND NOT EXISTS (SELECT 1 FROM public.company_profile_categories WHERE profile_id = checked_id) THEN
    RAISE EXCEPTION 'approved profile requires at least one category';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER approved_profile_has_category
AFTER INSERT OR UPDATE ON public.company_profiles DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.check_company_category_integrity();
CREATE CONSTRAINT TRIGGER approved_profile_keeps_category
AFTER DELETE OR UPDATE ON public.company_profile_categories DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.check_company_category_integrity();
