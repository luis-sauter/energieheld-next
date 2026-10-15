-- Add one internal editorial term to the existing taxonomy. No assignments,
-- schema, permissions, policies, media or publication state are changed.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.travel_terms
    WHERE (term_key = 'feature:sonderthema' OR (dimension = 'feature' AND slug = 'sonderthema'))
      AND (term_key <> 'feature:sonderthema' OR dimension <> 'feature' OR slug <> 'sonderthema' OR label <> 'Sonderthema')
  ) THEN
    RAISE EXCEPTION 'Conflicting special topic catalog entry; manual review required';
  END IF;
  INSERT INTO public.travel_terms (term_key, dimension, slug, label)
  VALUES ('feature:sonderthema', 'feature', 'sonderthema', 'Sonderthema')
  ON CONFLICT (term_key) DO NOTHING;
END
$migration$;
