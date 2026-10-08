-- Explicitly authorized correction of the Peter TEST profile, not inferred provenance.
-- Old Owner RPC wrote confirmed terms at 2026-10-08 20:16 UTC. An Admin also
-- inserted confirmed terms at 20:22 UTC (22:22 Europe/Berlin); term-level origin
-- cannot be reconstructed from logs. Louis authorized moving ALL seven terms.
-- Preserve the exact before-state privately; replay never resets later decisions.
CREATE TABLE IF NOT EXISTS private.peter_travel_proposal_correction (
  profile_id uuid PRIMARY KEY CHECK (profile_id='9fdfd0f3-8ee5-431c-9ecf-81043ac3ff90'),
  profile_before jsonb NOT NULL,
  confirmed_before jsonb NOT NULL,
  proposals_before jsonb NOT NULL,
  freshness_before jsonb NOT NULL,
  provenance_note text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.peter_travel_proposal_correction ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.peter_travel_proposal_correction FROM PUBLIC,anon,authenticated;

DO $$
DECLARE
  target CONSTANT uuid := '9fdfd0f3-8ee5-431c-9ecf-81043ac3ff90';
  expected CONSTANT text[] := ARRAY[
    'accommodation:camping','accommodation:ferienwohnung','audience:familie',
    'theme:campingurlaub','theme:golfurlaub','theme:radwandern','theme:urlaub-am-wasser'];
  profile public.company_profiles;
  freshness public.profile_content_freshness;
  actual text[];
BEGIN
  SELECT * INTO profile FROM public.company_profiles WHERE id=target FOR UPDATE;
  -- Profile lock serializes with Owner saves and editorial saves/reviews.
  -- Receipt survives later editorial changes: replay is always a no-op.
  IF EXISTS (SELECT 1 FROM private.peter_travel_proposal_correction WHERE profile_id=target) THEN
    RETURN;
  END IF;
  SELECT * INTO freshness FROM public.profile_content_freshness WHERE profile_id=target FOR UPDATE;
  SELECT COALESCE(array_agg(term_key ORDER BY term_key),'{}'::text[]) INTO actual
    FROM public.company_profile_travel_terms WHERE profile_id=target;
  IF profile.id IS NULL OR profile.display_name IS DISTINCT FROM 'Peter'
    OR profile.status IS DISTINCT FROM 'pending' OR profile.approved_at IS NOT NULL
    OR freshness.content_revision IS DISTINCT FROM 13::bigint
    OR actual IS DISTINCT FROM expected
    OR EXISTS (SELECT 1 FROM public.company_profile_travel_proposals WHERE profile_id=target)
  THEN RAISE EXCEPTION 'Peter correction baseline changed; inspect before applying' USING ERRCODE='40001'; END IF;

  -- Record first, in the SAME transaction as the transfer. No fake Owner origin.
  INSERT INTO private.peter_travel_proposal_correction
    (profile_id,profile_before,confirmed_before,proposals_before,freshness_before,provenance_note)
  VALUES (target,to_jsonb(profile),
    (SELECT jsonb_agg(to_jsonb(t) ORDER BY term_key) FROM public.company_profile_travel_terms t WHERE profile_id=target),
    '[]'::jsonb,to_jsonb(freshness),
    'Owner save 2026-10-08 20:16 UTC; Admin INSERT 20:22 UTC / 22:22 Europe/Berlin. Per-term provenance ambiguous. Louis explicitly authorized all seven as private proposals for this test profile only.');
  INSERT INTO public.company_profile_travel_proposals(profile_id,term_key)
    SELECT target,unnest(expected) ON CONFLICT DO NOTHING;
  DELETE FROM public.company_profile_travel_terms
    WHERE profile_id=target AND term_key=ANY(expected);
  -- Existing Freshness triggers record the classification change; no status write.
END;
$$;
