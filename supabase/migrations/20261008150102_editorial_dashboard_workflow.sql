-- Private Admin -> Owner feedback, separate from Owner -> Admin notes.
CREATE TABLE public.company_profile_review_feedback (
  profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
  reviewed_revision bigint NOT NULL,
  reviewed_by uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_profile_review_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_review_feedback FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_profile_review_feedback TO authenticated;
CREATE POLICY review_feedback_owner_read ON public.company_profile_review_feedback FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid())));
CREATE POLICY review_feedback_admin_read ON public.company_profile_review_feedback FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));

-- Lock the reviewed profile and revision, then write feedback and decision atomically.
-- Reuses the existing travel approval, including its capability and legacy guards.
CREATE FUNCTION private.review_travel_profile_with_feedback(p_profile_id uuid,p_decision text,p_feedback text,p_expected_revision bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE revision bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid() AND can_review_profiles) THEN
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
REVOKE ALL ON FUNCTION private.review_travel_profile_with_feedback(uuid,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.review_travel_profile_with_feedback(uuid,text,text,bigint) TO authenticated;
CREATE FUNCTION public.review_travel_profile_with_feedback(p_profile_id uuid,p_decision text,p_feedback text,p_expected_revision bigint)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.review_travel_profile_with_feedback(p_profile_id,p_decision,p_feedback,p_expected_revision); END;
REVOKE ALL ON FUNCTION public.review_travel_profile_with_feedback(uuid,text,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_travel_profile_with_feedback(uuid,text,text,bigint) TO authenticated;

-- A single snapshot for header/dashboard; no historical Freshness rows counted.
CREATE FUNCTION public.editorial_work_queue(p_page integer DEFAULT 1,p_limit integer DEFAULT 8,p_kind text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  IF p_page IS NULL OR p_limit IS NULL OR p_page NOT BETWEEN 1 AND 100000 OR p_limit NOT BETWEEN 1 AND 20 OR (p_kind IS NOT NULL AND p_kind NOT IN ('profile','advertising','verification')) THEN RAISE EXCEPTION 'invalid page'; END IF;
  WITH tasks AS (
    SELECT p.id,'profile'::text AS kind,p.display_name AS name,p.submitted_at AS submitted_at,'pending'::text AS status,'/admin/firmen/'||p.id AS href FROM public.company_profiles p WHERE p.status='pending'
    UNION ALL SELECT c.id,'advertising',c.internal_name,c.submitted_at,c.status,'/admin/werbung/'||c.id FROM public.company_ad_campaigns c WHERE c.status='pending' AND c.archived_at IS NULL AND NOT c.is_editorial
    UNION ALL SELECT q.profile_id,'verification',p.display_name,q.requested_at,q.status,'/admin/firmen/'||q.profile_id||'#verifizierung' FROM public.company_quality_requests q JOIN public.company_profiles p ON p.id=q.profile_id WHERE q.status='pending'
  ), counts AS (SELECT count(*) FILTER (WHERE kind='profile') AS profiles,count(*) FILTER (WHERE kind='advertising') AS advertising,count(*) FILTER (WHERE kind='verification') AS verifications,count(*) AS total FROM tasks)
  SELECT jsonb_build_object('counts',to_jsonb(counts),'tasks',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY submitted_at NULLS LAST,id,kind) FROM (SELECT * FROM tasks WHERE p_kind IS NULL OR kind=p_kind ORDER BY submitted_at NULLS LAST,id,kind LIMIT p_limit OFFSET (p_page-1)*p_limit)t),'[]'::jsonb)) INTO result FROM counts;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.editorial_work_queue(integer,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.editorial_work_queue(integer,integer,text) TO authenticated;

-- Bounded server-side company management, with parameterized search and stable paging.
CREATE FUNCTION public.editorial_company_page(p_status text,p_query text,p_page integer,p_sort text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('pending','approved','draft','rejected') THEN RAISE EXCEPTION 'invalid status'; END IF;
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000 OR char_length(COALESCE(p_query,''))>200 OR p_sort IS NULL OR p_sort NOT IN ('name','submitted') THEN RAISE EXCEPTION 'invalid page'; END IF;
  WITH filtered AS (
    SELECT p.id,p.display_name,p.city,p.status,p.submitted_at,c.legal_name FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
    WHERE (p_status IS NULL OR p.status=p_status) AND (COALESCE(p_query,'')='' OR p.display_name ILIKE '%'||p_query||'%' OR c.legal_name ILIKE '%'||p_query||'%' OR p.city ILIKE '%'||p_query||'%')
  ), page AS (SELECT * FROM filtered ORDER BY CASE WHEN p_sort='name' THEN lower(display_name) END,CASE WHEN p_sort='submitted' THEN submitted_at END NULLS LAST,id LIMIT 20 OFFSET (p_page-1)*20)
  SELECT jsonb_build_object('count',(SELECT count(*) FROM filtered),'profiles',COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY CASE WHEN p_sort='name' THEN lower(display_name) END,CASE WHEN p_sort='submitted' THEN submitted_at END NULLS LAST,id) FROM page),'[]'::jsonb)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.editorial_company_page(text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.editorial_company_page(text,text,integer,text) TO authenticated;
