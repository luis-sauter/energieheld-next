-- Local preparation only. No identity-based backfill: explicitly grant the
-- capability to the intended existing portal_admins row after deployment.
ALTER TABLE public.portal_admins
  ADD COLUMN can_review_profiles boolean NOT NULL DEFAULT false;
-- Existing self-read RLS still applies. No client may grant itself capabilities.
GRANT SELECT (can_review_profiles) ON public.portal_admins TO authenticated;

-- One canonical boundary for every revision increment made by the existing
-- content triggers (including both sides of a reassigned child row). The row
-- lock of the original upsert serializes this with review/invalidation RPCs.
CREATE FUNCTION private.preserve_profile_review_on_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.content_revision > OLD.content_revision
    AND OLD.reviewed_at IS NOT NULL
    AND OLD.reviewed_revision = OLD.content_revision
    AND OLD.review_invalidated_at IS NULL
    AND EXISTS (SELECT 1 FROM public.portal_admins
      WHERE user_id=auth.uid() AND can_review_profiles) THEN
    NEW.reviewed_revision := NEW.content_revision;
  END IF;
  -- Never change reviewed_at/by or invalidation. An overdue date stays overdue;
  -- an already stale, withdrawn or absent review cannot be resurrected here.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.preserve_profile_review_on_edit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profile_freshness_preserve_review BEFORE UPDATE OF content_revision
  ON public.profile_content_freshness FOR EACH ROW
  EXECUTE FUNCTION private.preserve_profile_review_on_edit();

CREATE OR REPLACE FUNCTION public.review_profile_content(p_profile_id uuid,p_expected_revision bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_revision bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins
    WHERE user_id=auth.uid() AND can_review_profiles) THEN
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

CREATE OR REPLACE FUNCTION public.invalidate_profile_review(
  p_profile_id uuid, p_expected_revision bigint, p_expected_reviewed_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_state public.profile_content_freshness;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins
    WHERE user_id=auth.uid() AND can_review_profiles) THEN
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
-- CREATE OR REPLACE preserves existing RPC ACLs. Freshness/table/Storage RLS
-- and all editing permissions remain unchanged; no direct review-field writes.
