-- Host proposals are private input, never public classification. No historical
-- assignments are copied, reclassified or deleted. Existing confirmed rows remain.
CREATE TABLE public.company_profile_travel_proposals (
  profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  term_key text NOT NULL REFERENCES public.travel_terms(term_key) ON DELETE RESTRICT,
  PRIMARY KEY (profile_id,term_key)
);
ALTER TABLE public.company_profile_travel_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_travel_proposals FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.company_profile_travel_proposals TO authenticated;
CREATE POLICY travel_proposals_owner_read ON public.company_profile_travel_proposals
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
  WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid())
));
CREATE POLICY travel_proposals_admin_read ON public.company_profile_travel_proposals
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));
CREATE POLICY travel_proposals_owner_insert ON public.company_profile_travel_proposals
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
    WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid()))
  AND (term_key LIKE 'theme:%' OR term_key LIKE 'accommodation:%'
    OR term_key IN ('audience:mit-hund','audience:familie','audience:paar'))
);
CREATE POLICY travel_proposals_owner_delete ON public.company_profile_travel_proposals
FOR DELETE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
  WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid())
));
-- Remove only the two owner-write paths into CONFIRMED classification.
-- Admin/public/read policies and all stored assignments are unchanged.
DROP POLICY profile_travel_terms_owner_insert ON public.company_profile_travel_terms;
DROP POLICY profile_travel_terms_owner_delete ON public.company_profile_travel_terms;

-- Serialize direct proposal writes with Owner saves and editorial decisions.
CREATE FUNCTION private.lock_travel_proposal_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.company_profiles WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.profile_id ELSE NEW.profile_id END FOR UPDATE;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.lock_travel_proposal_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER lock_travel_proposal_profile BEFORE INSERT OR DELETE ON public.company_profile_travel_proposals
FOR EACH ROW EXECUTE FUNCTION private.lock_travel_proposal_profile();

CREATE OR REPLACE FUNCTION public.save_own_travel_profile(fields jsonb, selected_terms text[], expected_status text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  own_profile public.company_profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT p.* INTO STRICT own_profile FROM public.company_profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE c.owner_user_id = auth.uid() FOR UPDATE OF p;
  IF own_profile.status <> expected_status THEN RAISE EXCEPTION 'Profile changed'; END IF;
  IF jsonb_typeof(fields) <> 'object' OR fields IS NULL
    OR nullif(btrim(fields->>'display_name'), '') IS NULL
    OR EXISTS (SELECT 1 FROM jsonb_each(fields) f WHERE f.key <> ALL(ARRAY[
      'display_name','business_areas','tagline','description','phone','public_email','website',
      'street','postal_code','city','region','country','contact_first_name','contact_last_name'])
      OR jsonb_typeof(f.value) NOT IN ('string','null'))
    OR char_length(fields->>'contact_first_name') > 120 OR char_length(fields->>'contact_last_name') > 120
  THEN RAISE EXCEPTION 'Invalid profile fields'; END IF;
  IF cardinality(selected_terms) > 100 THEN RAISE EXCEPTION 'Too many proposals'; END IF;
  IF selected_terms IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(selected_terms) k WHERE k IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.travel_terms t WHERE t.term_key = k
        AND (t.dimension IN ('theme','accommodation')
          OR t.term_key IN ('audience:mit-hund','audience:familie','audience:paar'))
    )
  ) THEN RAISE EXCEPTION 'Invalid travel terms'; END IF;

  UPDATE public.company_profiles SET
    display_name = fields->>'display_name', business_areas = fields->>'business_areas',
    tagline = fields->>'tagline', description = fields->>'description',
    phone = fields->>'phone', public_email = fields->>'public_email', website = fields->>'website',
    street = fields->>'street', postal_code = fields->>'postal_code', city = fields->>'city', region = fields->>'region',
    country = CASE WHEN fields ? 'country' THEN fields->>'country' ELSE own_profile.country END,
    contact_first_name = CASE WHEN fields ? 'contact_first_name' THEN fields->>'contact_first_name' ELSE own_profile.contact_first_name END,
    contact_last_name = CASE WHEN fields ? 'contact_last_name' THEN fields->>'contact_last_name' ELSE own_profile.contact_last_name END
  WHERE id = own_profile.id;
  IF selected_terms IS NOT NULL THEN
    DELETE FROM public.company_profile_travel_proposals x WHERE x.profile_id = own_profile.id
      AND x.term_key IN (SELECT t.term_key FROM public.travel_terms t
        WHERE t.dimension IN ('theme','accommodation')
          OR t.term_key IN ('audience:mit-hund','audience:familie','audience:paar'))
      AND NOT (x.term_key = ANY(selected_terms));
    INSERT INTO public.company_profile_travel_proposals (profile_id,term_key)
      SELECT own_profile.id,k FROM (SELECT DISTINCT unnest(selected_terms) k) choices
      ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_own_travel_profile(jsonb,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_own_travel_profile(jsonb,text[],text) TO authenticated;

-- Louis' development policy: every actual portal_admin may first-review travel
-- profiles. No role rows or Freshness/legacy-energy capabilities are changed.
CREATE FUNCTION public.can_review_travel_profiles() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) $$;
REVOKE ALL ON FUNCTION public.can_review_travel_profiles() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_travel_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_profile_approval_context() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.approval_context IS DISTINCT FROM OLD.approval_context AND (
    NOT public.can_review_travel_profiles() OR OLD.status <> 'pending' OR NEW.status <> 'approved'
    OR OLD.approval_context <> 'energyheld' OR NEW.approval_context <> 'reiseportal'
  ) THEN RAISE EXCEPTION 'approval context is review controlled' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.review_travel_company_profile(p_profile_id uuid,p_decision text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
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

CREATE OR REPLACE FUNCTION private.review_travel_profile_with_feedback(p_profile_id uuid,p_decision text,p_feedback text,p_expected_revision bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE revision bigint;
BEGIN
  IF NOT public.can_review_travel_profiles() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM public.company_profiles WHERE id=p_profile_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not pending'; END IF;
  SELECT content_revision INTO revision FROM public.profile_content_freshness WHERE profile_id=p_profile_id FOR UPDATE;
  IF revision IS NULL OR p_expected_revision IS DISTINCT FROM revision THEN RAISE EXCEPTION 'profile changed; reload review' USING ERRCODE='40001'; END IF;
  IF p_decision='rejected' THEN
    IF p_feedback IS NULL OR char_length(btrim(p_feedback)) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'feedback required'; END IF;
    INSERT INTO public.company_profile_review_feedback(profile_id,message,reviewed_revision,reviewed_by)
      VALUES(p_profile_id,btrim(p_feedback),revision,auth.uid())
      ON CONFLICT (profile_id) DO UPDATE SET message=EXCLUDED.message,reviewed_revision=EXCLUDED.reviewed_revision,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=now();
  END IF;
  RETURN private.review_travel_company_profile(p_profile_id,p_decision);
END;
$$;

-- Narrow private definer is needed to lock Freshness without granting API roles
-- direct UPDATE access to review metadata. It explicitly authorizes real admins.
CREATE FUNCTION private.save_profile_travel_assignments(p_profile_id uuid,p_terms text[],p_expected_terms text[],p_expected_proposals text[],p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE revision bigint; current_terms text[]; current_proposals text[];
BEGIN
  IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  IF p_terms IS NULL OR p_expected_terms IS NULL OR p_expected_proposals IS NULL
    OR cardinality(p_terms)>500 OR cardinality(p_expected_terms)>500 OR cardinality(p_expected_proposals)>100
    OR EXISTS (SELECT 1 FROM unnest(p_terms) k WHERE k IS NULL OR NOT EXISTS(SELECT 1 FROM public.travel_terms WHERE term_key=k))
  THEN RAISE EXCEPTION 'invalid assignments' USING ERRCODE='22023'; END IF;
  PERFORM 1 FROM public.company_profiles WHERE id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
  SELECT content_revision INTO revision FROM public.profile_content_freshness WHERE profile_id=p_profile_id FOR UPDATE;
  SELECT COALESCE(array_agg(term_key ORDER BY term_key),'{}'::text[]) INTO current_terms FROM public.company_profile_travel_terms WHERE profile_id=p_profile_id;
  SELECT COALESCE(array_agg(term_key ORDER BY term_key),'{}'::text[]) INTO current_proposals FROM public.company_profile_travel_proposals WHERE profile_id=p_profile_id;
  IF revision IS NULL OR p_expected_revision IS DISTINCT FROM revision
    OR current_terms IS DISTINCT FROM ARRAY(SELECT DISTINCT unnest(p_expected_terms) ORDER BY 1)
    OR current_proposals IS DISTINCT FROM ARRAY(SELECT DISTINCT unnest(p_expected_proposals) ORDER BY 1)
  THEN RAISE EXCEPTION 'profile changed; reload review' USING ERRCODE='40001'; END IF;
  DELETE FROM public.company_profile_travel_terms WHERE profile_id=p_profile_id AND NOT(term_key=ANY(p_terms));
  INSERT INTO public.company_profile_travel_terms(profile_id,term_key)
    SELECT p_profile_id,k FROM (SELECT DISTINCT unnest(p_terms) k) choices ON CONFLICT DO NOTHING;
  SELECT content_revision INTO revision FROM public.profile_content_freshness WHERE profile_id=p_profile_id;
  RETURN jsonb_build_object('assignedKeys',ARRAY(SELECT term_key FROM public.company_profile_travel_terms WHERE profile_id=p_profile_id ORDER BY term_key),'revision',revision);
END;
$$;
REVOKE ALL ON FUNCTION private.save_profile_travel_assignments(uuid,text[],text[],text[],bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.save_profile_travel_assignments(uuid,text[],text[],text[],bigint) TO authenticated;
CREATE FUNCTION public.save_profile_travel_assignments(p_profile_id uuid,p_terms text[],p_expected_terms text[],p_expected_proposals text[],p_expected_revision bigint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.save_profile_travel_assignments(p_profile_id,p_terms,p_expected_terms,p_expected_proposals,p_expected_revision); END;
REVOKE ALL ON FUNCTION public.save_profile_travel_assignments(uuid,text[],text[],text[],bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_profile_travel_assignments(uuid,text[],text[],text[],bigint) TO authenticated;

-- Read taxonomy, proposals and revision in ONE snapshot, avoiding stale mixed
-- initial states from independent requests. Public vocabulary still uses its RLS.
CREATE FUNCTION public.admin_profile_travel_review(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.company_profiles WHERE id=p_profile_id) THEN RAISE EXCEPTION 'profile not found'; END IF;
  RETURN jsonb_build_object(
    'terms',COALESCE((SELECT jsonb_agg(jsonb_build_object('term_key',term_key,'dimension',dimension,'label',label) ORDER BY dimension,label,term_key) FROM public.travel_terms),'[]'::jsonb),
    'assignedKeys',ARRAY(SELECT term_key FROM public.company_profile_travel_terms WHERE profile_id=p_profile_id ORDER BY term_key),
    'proposedKeys',ARRAY(SELECT term_key FROM public.company_profile_travel_proposals WHERE profile_id=p_profile_id ORDER BY term_key),
    'revision',(SELECT content_revision FROM public.profile_content_freshness WHERE profile_id=p_profile_id));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_profile_travel_review(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_profile_travel_review(uuid) TO authenticated;

-- Also reject first-approval based on a stale proposal snapshot. Reuses the
-- existing revision-checked feedback/decision path, not a second approval flow.
CREATE FUNCTION private.review_travel_profile_with_proposals(p_profile_id uuid,p_decision text,p_feedback text,p_expected_revision bigint,p_expected_proposals text[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.company_profiles WHERE id=p_profile_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not pending'; END IF;
  IF p_expected_proposals IS NULL OR ARRAY(SELECT term_key FROM public.company_profile_travel_proposals WHERE profile_id=p_profile_id ORDER BY term_key)
    IS DISTINCT FROM ARRAY(SELECT DISTINCT unnest(p_expected_proposals) ORDER BY 1)
  THEN RAISE EXCEPTION 'proposals changed; reload review' USING ERRCODE='40001'; END IF;
  RETURN private.review_travel_profile_with_feedback(p_profile_id,p_decision,p_feedback,p_expected_revision);
END;
$$;
REVOKE ALL ON FUNCTION private.review_travel_profile_with_proposals(uuid,text,text,bigint,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.review_travel_profile_with_proposals(uuid,text,text,bigint,text[]) TO authenticated;
CREATE FUNCTION public.review_travel_profile_with_proposals(p_profile_id uuid,p_decision text,p_feedback text,p_expected_revision bigint,p_expected_proposals text[])
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.review_travel_profile_with_proposals(p_profile_id,p_decision,p_feedback,p_expected_revision,p_expected_proposals); END;
REVOKE ALL ON FUNCTION public.review_travel_profile_with_proposals(uuid,text,text,bigint,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_travel_profile_with_proposals(uuid,text,text,bigint,text[]) TO authenticated;
