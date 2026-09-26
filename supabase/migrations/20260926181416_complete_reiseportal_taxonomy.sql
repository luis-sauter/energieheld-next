-- Only classifications explicitly named by Joomla's structured article data.
-- Profile slugs resolve the current Cloud rows; no owner or profile is created.
-- See docs/reiseportal-taxonomy-source-matrix.md for the source audit.
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM (VALUES
      ('hoeflehner', 'audience:familie'),
      ('anni-romantikhaeuschen', 'audience:paar'),
      ('pension-sonnenhof', 'accommodation:pension'),
      ('hotel-zur-post', 'accommodation:hotel'),
      ('golfhotel-andreus', 'accommodation:hotel')
    ) AS source(profile_slug, term_key)
    JOIN public.company_profiles p ON p.slug = source.profile_slug AND p.status = 'approved'
    JOIN public.travel_terms t ON t.term_key = source.term_key
  ) <> 5 THEN
    RAISE EXCEPTION 'The five sourced Reiseportal taxonomy assignments cannot be resolved';
  END IF;
END $$;

INSERT INTO public.company_profile_travel_terms (profile_id, term_key)
SELECT p.id, source.term_key
FROM (VALUES
  ('hoeflehner', 'audience:familie'),
  ('anni-romantikhaeuschen', 'audience:paar'),
  ('pension-sonnenhof', 'accommodation:pension'),
  ('hotel-zur-post', 'accommodation:hotel'),
  ('golfhotel-andreus', 'accommodation:hotel')
) AS source(profile_slug, term_key)
JOIN public.company_profiles p ON p.slug = source.profile_slug AND p.status = 'approved'
ON CONFLICT (profile_id, term_key) DO NOTHING;
