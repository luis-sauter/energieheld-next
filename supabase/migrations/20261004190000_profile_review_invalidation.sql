-- Withdraw trust explicitly without deleting the last genuine review.
ALTER TABLE public.profile_content_freshness
  ADD COLUMN review_invalidated_at timestamptz,
  ADD COLUMN review_invalidated_by uuid,
  ADD CONSTRAINT profile_review_invalidation_valid CHECK (
    (review_invalidated_at IS NULL AND review_invalidated_by IS NULL)
    OR (review_invalidated_at IS NOT NULL AND review_invalidated_by IS NOT NULL AND reviewed_at IS NOT NULL)
  );

CREATE FUNCTION public.invalidate_profile_review(
  p_profile_id uuid, p_expected_revision bigint, p_expected_reviewed_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_state public.profile_content_freshness;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  SELECT * INTO current_state FROM public.profile_content_freshness WHERE profile_id=p_profile_id FOR UPDATE;
  IF current_state.profile_id IS NULL THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision<>current_state.content_revision
    OR p_expected_reviewed_at IS NULL OR current_state.reviewed_at IS DISTINCT FROM p_expected_reviewed_at
    OR current_state.review_invalidated_at IS NOT NULL THEN
    RAISE EXCEPTION 'review changed since loading' USING ERRCODE='PT409';
  END IF;
  UPDATE public.profile_content_freshness SET review_invalidated_at=clock_timestamp(),
    review_invalidated_by=auth.uid() WHERE profile_id=p_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_profile_review(uuid,bigint,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.invalidate_profile_review(uuid,bigint,timestamptz) TO authenticated;

-- Preserve the existing authorization, lock and content-revision CAS.
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
    reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),
    review_invalidated_at=NULL,review_invalidated_by=NULL WHERE profile_id=p_profile_id;
END;
$$;

-- Unused by public UI, but the dates-only allowlist must never report withdrawn trust.
CREATE OR REPLACE FUNCTION public.public_profile_freshness(p_profile_id uuid)
RETURNS TABLE(content_updated_at timestamptz,checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT f.content_updated_at,CASE WHEN f.reviewed_revision=f.content_revision
    AND f.review_invalidated_at IS NULL THEN f.reviewed_at ELSE NULL END
    FROM public.profile_content_freshness f JOIN public.company_profiles p ON p.id=f.profile_id
    WHERE f.profile_id=p_profile_id AND p.status='approved';
$$;
