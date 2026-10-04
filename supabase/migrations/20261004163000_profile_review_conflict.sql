-- Business conflicts must not use serialization_failure: PostgREST retries that code.
-- Only the conflict response changes; function ownership, grants, locking and RLS remain unchanged.
CREATE OR REPLACE FUNCTION public.review_profile_content(p_profile_id uuid,p_expected_revision bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_revision bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  SELECT content_revision INTO current_revision FROM public.profile_content_freshness
    WHERE profile_id=p_profile_id FOR UPDATE;
  IF current_revision IS NULL THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision<>current_revision THEN
    RAISE EXCEPTION 'profile changed since review' USING ERRCODE='PT409';
  END IF;
  UPDATE public.profile_content_freshness SET reviewed_revision=current_revision,
    reviewed_at=clock_timestamp(),reviewed_by=auth.uid() WHERE profile_id=p_profile_id;
END;
$$;
