-- Separate editorial transfer; apply only after explicit approval, before the
-- dependent frontend deploy. Not part of automatic migrations or seed commands.
-- The four IDs are the existing visually reviewed homepage selection.
DO $seed$
DECLARE
  selected_ids uuid[] := ARRAY[
    '027d641f-c71d-402b-a5f3-aa6b293bf602',
    '6cd02ae2-75ab-4273-8cd8-fc62da38b2db',
    '36716652-fed2-4758-bb13-81880bbaa33d',
    '02ffb4a9-087f-40af-8c0e-5c0f85f7b27c'
  ]::uuid[];
  inserted_count integer;
BEGIN
  PERFORM 1 FROM public.travel_terms WHERE term_key = 'feature:sonderthema'
    AND dimension = 'feature' AND slug = 'sonderthema' AND label = 'Sonderthema';
  IF NOT FOUND THEN RAISE EXCEPTION 'Special topic catalog entry missing'; END IF;
  -- Lock precisely the affected profiles; never change their publication state.
  PERFORM 1 FROM public.company_profiles WHERE id = ANY(selected_ids) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.company_profiles p
      LEFT JOIN public.company_profile_public_visibility v ON v.profile_id = p.id
      WHERE p.id = ANY(selected_ids) AND p.status = 'approved' AND coalesce(v.is_listed, true)
      AND EXISTS (SELECT 1 FROM public.company_profile_travel_terms t
                  WHERE t.profile_id = p.id AND t.term_key = 'theme:saison-herbst')) <> 4
    OR EXISTS (SELECT 1 FROM public.company_profile_travel_terms WHERE term_key = 'feature:sonderthema')
  THEN
    RAISE EXCEPTION 'Showcase baseline changed or special topic decisions already exist; review before transfer';
  END IF;
  INSERT INTO public.company_profile_travel_terms (profile_id, term_key)
    SELECT unnest(selected_ids), 'feature:sonderthema';
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 4 THEN RAISE EXCEPTION 'Unexpected transfer count'; END IF;
END
$seed$;
