-- Explicit approval provenance: no existing approvals or assignments are reclassified.
-- Existing legacy RPCs keep requiring energy categories. Only this new,
-- capability-checked Reiseportal decision opts a pending profile into travel.
ALTER TABLE public.company_profiles
  ADD COLUMN approval_context text NOT NULL DEFAULT 'energyheld'
  CONSTRAINT company_profile_approval_context CHECK (approval_context IN ('energyheld','reiseportal'));
GRANT SELECT (approval_context) ON public.company_profiles TO anon, authenticated;
-- Deliberately no INSERT/UPDATE grant on approval_context for API roles.

CREATE FUNCTION private.guard_profile_approval_context() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.approval_context IS DISTINCT FROM OLD.approval_context AND (
    auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid() AND can_review_profiles
    ) OR OLD.status <> 'pending' OR NEW.status <> 'approved'
    OR OLD.approval_context <> 'energyheld' OR NEW.approval_context <> 'reiseportal'
  ) THEN RAISE EXCEPTION 'approval context is review controlled' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_profile_approval_context() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_profile_approval_context BEFORE UPDATE OF approval_context
  ON public.company_profiles FOR EACH ROW EXECUTE FUNCTION private.guard_profile_approval_context();

-- Preserve the existing owned-energyheld and unclaimed-editorial rules.
-- Never remove category relations or exempt existing profiles automatically.
CREATE OR REPLACE FUNCTION public.check_company_category_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE checked_id uuid;
BEGIN
  IF TG_TABLE_NAME='company_profiles' THEN
    IF NEW.status <> 'approved' THEN RETURN NULL; END IF;
    checked_id := NEW.id;
  ELSE checked_id := OLD.profile_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
    WHERE p.id=checked_id AND p.status='approved' AND c.owner_user_id IS NOT NULL
      AND p.approval_context='energyheld'
  ) AND NOT EXISTS (SELECT 1 FROM public.company_profile_categories WHERE profile_id=checked_id) THEN
    RAISE EXCEPTION 'approved profile requires at least one category';
  END IF;
  RETURN NULL;
END;
$$;

-- Status/approved_at/context have no direct API write grants. This deliberately
-- narrow definer entry point is required for an atomic, authorized decision.
-- Like the existing approval RPCs it is only executable by authenticated;
-- unlike them it also enforces the existing explicit review capability.
CREATE FUNCTION private.review_travel_company_profile(p_profile_id uuid,p_decision text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid() AND can_review_profiles
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;
  PERFORM 1 FROM public.company_profiles WHERE id=p_profile_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not pending or not found'; END IF;
  UPDATE public.company_profiles SET status=p_decision,
    approved_at=CASE WHEN p_decision='approved' THEN now() ELSE NULL END,
    approval_context=CASE WHEN p_decision='approved' THEN 'reiseportal' ELSE approval_context END
    WHERE id=p_profile_id;
  RETURN p_decision;
END;
$$;
REVOKE ALL ON FUNCTION private.review_travel_company_profile(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.review_travel_company_profile(uuid,text) TO authenticated;

-- SQL-standard body binds the private function at creation. No private-schema
-- USAGE grant or publicly exposed SECURITY DEFINER function is introduced.
CREATE FUNCTION public.review_travel_company_profile(p_profile_id uuid,p_decision text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC
  SELECT private.review_travel_company_profile(p_profile_id,p_decision);
END;
REVOKE ALL ON FUNCTION public.review_travel_company_profile(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_travel_company_profile(uuid,text) TO authenticated;
