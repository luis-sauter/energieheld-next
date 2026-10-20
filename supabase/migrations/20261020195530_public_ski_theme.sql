-- Explicit editorial activation of skiing. Existing raw internal ski evidence
-- is not bulk-promoted; reviewed assignments are applied separately.
INSERT INTO public.travel_terms(term_key,dimension,slug,label)
VALUES('theme:skifahren','theme','skifahren','Skiurlaub')
ON CONFLICT(term_key) DO NOTHING;

CREATE OR REPLACE FUNCTION acquisition.basic_theme_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT ARRAY['theme:natur-pur','theme:nordic-walking','theme:radwandern','theme:wanderurlaub',
 'theme:familienurlaub','theme:golfurlaub','theme:urlaub-am-wasser','theme:campingurlaub',
 'theme:romantik-zu-zweit','theme:wellnessangebote','theme:geschaeftsreisen','theme:skifahren']::text[];
$$;
